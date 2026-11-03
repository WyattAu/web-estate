// @est/fetchkit: fetch pipeline for estate backends. Retry semantics are a
// TS mirror of the retry-backoff crate (same formula, same defaults);
// response bodies decode through @est/envelope; HTTP failures map onto
// @est/errcode. Cache semantics are out of scope (future @est/cachekit).

import { type ApiResponse, decodeEnvelope, envelopeError } from "@est/envelope";
import { type ErrorCodeName, errcode } from "@est/errcode";

/** Retry policy; mirrors retry-backoff::RetryConfig field for field. */
export interface RetryConfig {
  /** Retries after the first attempt (0 = try once). */
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

/** Same defaults as RetryConfig::default(). */
export const RETRY_DEFAULTS: Readonly<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2.0,
  jitter: true,
};

/**
 * Delay before retry `attempt` (0-indexed): initial * multiplier^attempt,
 * capped at maxDelay, plus up to 10% additive jitter when enabled.
 * Mirrors retry-backoff::RetryConfig::delay_for_attempt.
 */
export function delayForAttempt(config: RetryConfig, attempt: number): number {
  const base = config.initialDelayMs * config.backoffMultiplier ** attempt;
  const capped = Math.min(base, config.maxDelayMs);
  if (config.jitter) {
    const jitter = Math.random() * capped * 0.1;
    return Math.floor(capped + jitter);
  }
  return Math.floor(capped);
}

const STATUS_CODES: Readonly<Record<number, ErrorCodeName>> = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  422: "Validation",
  429: "RateLimited",
  500: "Internal",
  502: "Internal",
  503: "Unavailable",
};

/** Retryable: network errors, 429, and 5xx. Everything else stops. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function errcodeForStatus(status: number): ErrorCodeName {
  return STATUS_CODES[status] ?? (status >= 500 ? "Internal" : "BadRequest");
}

export interface FetchKitOutcome<T> {
  envelope: ApiResponse<T>;
  /** Attempts actually made (1 = no retry). */
  attempts: number;
  /** True when the loop ended because retries were exhausted (and failed). */
  exhausted: boolean;
}

export interface JsonOutcome<T> {
  ok: boolean;
  status: number;
  /** Parsed JSON body on 2xx with a parseable body; undefined otherwise. */
  body?: T;
  /** Error detail for non-2xx or unparseable bodies. */
  error?: string;
  attempts: number;
  exhausted: boolean;
}

export interface FetchKit {
  /** Fetch and decode an ApiResponse envelope; errors become envelopes. */
  fetchEnvelope<T = unknown>(url: string, init?: RequestInit): Promise<ApiResponse<T>>;
  /** Same, with retry metadata for callers that need it. */
  fetchEnvelopeWithMeta<T = unknown>(url: string, init?: RequestInit): Promise<FetchKitOutcome<T>>;
  /**
   * Retrying fetch for services that predate the envelope convention:
   * same loop, no decode. 2xx with a parseable body returns it; anything
   * else is a non-ok outcome carrying the status (no envelopes invented).
   */
  fetchJsonWithMeta<T = unknown>(url: string, init?: RequestInit): Promise<JsonOutcome<T>>;
}

export interface FetchKitOptions {
  retry?: Partial<RetryConfig>;
  /** Injectable fetch for tests and wrappers. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
  /** AbortSignal honored across attempts (abort stops the loop). */
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Create a FetchKit. Retryable transport/5xx failures back off and retry. */
export function createFetchKit(options: FetchKitOptions = {}): FetchKit {
  const config: RetryConfig = { ...RETRY_DEFAULTS, ...options.retry };
  const doFetch = options.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));

  /** Raw attempt: fetch, retryability classification, best-effort JSON. */
  async function attemptRaw(
    url: string,
    init?: RequestInit,
  ): Promise<{ res?: Response; json?: unknown; retryable: boolean; error?: string }> {
    let res: Response;
    try {
      res = await doFetch(url, init);
    } catch (error) {
      // Transport errors are retryable (mirrors io-error retryability).
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return { retryable: true, error: `network error: ${String(error)}` };
    }
    if (!res.ok) {
      const json: unknown = await res.json().catch(() => undefined);
      return { res, json, retryable: isRetryableStatus(res.status), error: res.statusText };
    }
    const json: unknown = await res.json().catch(() => undefined);
    return { res, json, retryable: false };
  }

  async function attemptOnce<T>(
    url: string,
    init?: RequestInit,
  ): Promise<{
    envelope: ApiResponse<T>;
    retryable: boolean;
  }> {
    const raw = await attemptRaw(url, init);
    if (!raw.res) {
      return {
        envelope: envelopeError("Unavailable", raw.error ?? "network error", {
          cause: raw.error,
          url,
        }),
        retryable: true,
      };
    }

    if (raw.res.ok) {
      const decoded = decodeEnvelope<T>(raw.json);
      if (!decoded.ok) {
        // A 2xx body that is not an envelope is a protocol violation:
        // surface it as an Internal error envelope, not a crash.
        return {
          envelope: envelopeError("Internal", decoded.reason, { url }),
          retryable: false,
        };
      }
      return { envelope: decoded.envelope, retryable: false };
    }

    const status = raw.res.status;
    const name = errcodeForStatus(status);
    // Prefer the server's own error envelope (axum-stack sends one).
    if (raw.json && typeof raw.json === "object") {
      const decoded = decodeEnvelope<T>(raw.json);
      if (decoded.ok && !decoded.envelope.success) {
        return { envelope: decoded.envelope, retryable: isRetryableStatus(status) };
      }
    }
    return {
      envelope: envelopeError(errcode(name).code, errcode(name).reason, { status, url }),
      retryable: isRetryableStatus(status),
    };
  }

  async function fetchJsonWithMeta<T>(url: string, init?: RequestInit): Promise<JsonOutcome<T>> {
    let attempts = 0;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts = attempt + 1;
      const raw = await attemptRaw(url, init);
      const last = attempt === config.maxRetries;
      if (raw.res?.ok) {
        if (raw.json === undefined) {
          return {
            ok: false,
            status: raw.res.status,
            error: "body is not JSON",
            attempts,
            exhausted: false,
          };
        }
        return {
          ok: true,
          status: raw.res.status,
          body: raw.json as T,
          attempts,
          exhausted: false,
        };
      }
      if (!raw.retryable || last) {
        const outcome: JsonOutcome<T> = {
          ok: false,
          status: raw.res?.status ?? 0,
          attempts,
          exhausted: raw.retryable && last,
        };
        if (raw.error !== undefined) outcome.error = raw.error;
        return outcome;
      }
      await sleep(delayForAttempt(config, attempt), options.signal);
    }
    throw new Error("fetchkit: retry loop escaped");
  }

  async function fetchEnvelopeWithMeta<T>(
    url: string,
    init?: RequestInit,
  ): Promise<FetchKitOutcome<T>> {
    let attempts = 0;
    // Loop shape mirrors retry-backoff::with_backoff: 0..=max_retries.
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      attempts = attempt + 1;
      const { envelope, retryable } = await attemptOnce<T>(url, init);
      const last = attempt === config.maxRetries;
      const success = envelope.success;
      if (!retryable || last) {
        return { envelope, attempts, exhausted: !success && retryable && last };
      }
      await sleep(delayForAttempt(config, attempt), options.signal);
    }
    // Unreachable: the loop returns on the final attempt.
    throw new Error("fetchkit: retry loop escaped");
  }

  return {
    async fetchEnvelope<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
      const { envelope } = await fetchEnvelopeWithMeta<T>(url, init);
      return envelope;
    },
    fetchEnvelopeWithMeta,
    fetchJsonWithMeta,
  };
}
