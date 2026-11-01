import { describe, expect, test } from "bun:test";
import { errcode } from "@est/errcode";
import cases from "../../conformance/fetchkit/cases.json";
import {
  createFetchKit,
  delayForAttempt,
  errcodeForStatus,
  isRetryableStatus,
  RETRY_DEFAULTS,
  type RetryConfig,
} from "./src/index";

type DelayCase = { kind: "delay"; attempt: number; expected_ms: number };
type StatusCase = { kind: "status"; status: number; retryable: boolean; errcode: string };
type FlowCase = {
  kind: "flow";
  name: string;
  script: number[];
  attempts: number;
  config?: { max_retries: number };
};
type Case = DelayCase | StatusCase | FlowCase;
type Defaults = {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  jitter: boolean;
};

const suite = cases as unknown as { suite: string; defaults: Defaults; cases: Case[] };

const deterministic: RetryConfig = {
  maxRetries: suite.defaults.max_retries,
  initialDelayMs: suite.defaults.initial_delay_ms,
  maxDelayMs: suite.defaults.max_delay_ms,
  backoffMultiplier: suite.defaults.backoff_multiplier,
  jitter: false,
};

describe("conformance: fetchkit", () => {
  test("fixture suite is fetchkit", () => {
    expect(suite.suite).toBe("fetchkit");
  });

  test("defaults mirror retry-backoff::RetryConfig::default", () => {
    expect(RETRY_DEFAULTS).toEqual({
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2.0,
      jitter: true,
    });
  });

  for (const c of suite.cases) {
    if (c.kind === "delay") {
      test(`delay attempt ${c.attempt} (no jitter) = ${c.expected_ms}ms`, () => {
        expect(delayForAttempt(deterministic, c.attempt)).toBe(c.expected_ms);
      });
    } else if (c.kind === "status") {
      test(`status ${c.status} -> ${c.errcode}, retryable=${c.retryable}`, () => {
        expect(isRetryableStatus(c.status)).toBe(c.retryable);
        // The fixture asserts the wire code (crate as_str), not the variant name.
        expect(errcode(errcodeForStatus(c.status)).code).toBe(c.errcode);
      });
    } else {
      test(`flow: ${c.name}`, async () => {
        let calls = 0;
        const kit = createFetchKit({
          retry: {
            ...deterministic,
            ...(c.config?.max_retries !== undefined ? { maxRetries: c.config.max_retries } : {}),
          },
          fetchImpl: (async () => {
            const status = c.script[Math.min(calls, c.script.length - 1)] as number;
            calls++;
            return new Response(
              status === 200
                ? JSON.stringify({ success: true, data: { ok: true } })
                : JSON.stringify({ success: false, error: { code: "X", message: "fail" } }),
              { status },
            );
          }) as unknown as typeof fetch,
        });
        const out = await kit.fetchEnvelopeWithMeta("/u");
        expect(out.attempts).toBe(c.attempts);
        // Success is decided by the status of the LAST ATTEMPT, not the
        // last script entry (a no-retries config never sees the retry).
        const lastAttemptStatus = c.script[c.attempts - 1] as number;
        expect(out.envelope.success).toBe(lastAttemptStatus === 200);
      });
    }
  }

  test("server error envelope is preferred over the synthesized one", async () => {
    const kit = createFetchKit({
      retry: { maxRetries: 0 },
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ success: false, error: { code: "RATE_LIMITED", message: "slow down" } }),
          { status: 429 },
        )) as unknown as typeof fetch,
    });
    const env = await kit.fetchEnvelope("/u");
    expect(env.success).toBe(false);
    expect(env.error?.code).toBe("RATE_LIMITED");
    expect(env.error?.message).toBe("slow down");
  });

  test("jitter stays within +10% of the capped delay", () => {
    const cfg: RetryConfig = { ...deterministic, jitter: true };
    for (let i = 0; i < 50; i++) {
      const d = delayForAttempt(cfg, 0);
      expect(d).toBeGreaterThanOrEqual(100);
      expect(d).toBeLessThanOrEqual(110);
    }
  });
});
