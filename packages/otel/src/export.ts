// Span export: POST OTLP-JSON spans to a collector endpoint via injected
// fetch. Fire-and-forget semantics are the caller's choice; this module
// is pure transport with an injectable fetch for tests.

import { makeSpan, type OtlpSpan } from "./index";

type RequestInit = { method?: string; headers?: Record<string, string>; body?: string };

export interface ExportOptions {
  /** OTLP/HTTP-JSON collector endpoint (e.g. /api/traces). */
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export interface ExportResult {
  accepted: boolean;
  status: number;
}

/**
 * POST spans as an OTLP-JSON resourceSpans document. Returns whether the
 * collector accepted them (2xx). Transport failures resolve with
 * accepted: false — export is best-effort by contract.
 */
export async function exportSpans(
  spans: readonly OtlpSpan[],
  options: ExportOptions,
): Promise<ExportResult> {
  const doFetch = options.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  const body = {
    resourceSpans: [
      {
        scopeSpans: [{ spans }],
      },
    ],
  };
  try {
    const res = await doFetch(options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { accepted: res.ok, status: res.status };
  } catch {
    return { accepted: false, status: 0 };
  }
}

export { makeSpan };
