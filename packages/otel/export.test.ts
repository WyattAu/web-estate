import { describe, expect, test } from "bun:test";
import { exportSpans, makeSpan } from "./src/export";

describe("otel span export", () => {
  test("POSTs an OTLP resourceSpans document and reports acceptance", async () => {
    let captured: { url: string; method: string; body: unknown } | null = null;
    const result = await exportSpans(
      [makeSpan("a".repeat(32), "GET /api/health", { "http.method": "GET" }, 1000, 2000)],
      {
        endpoint: "https://collector.test/api/traces",
        fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
          captured = {
            url: String(input),
            method: init?.method ?? "GET",
            body: init?.body ? JSON.parse(String(init.body)) : undefined,
          };
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }) as unknown as typeof fetch,
      },
    );
    expect(result.accepted).toBe(true);
    expect(result.status).toBe(200);
    expect(captured?.method).toBe("POST");
    const body = captured?.body as
      | { resourceSpans?: { scopeSpans?: { spans?: unknown[] } }[] }
      | undefined;
    expect(body?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans).toHaveLength(1);
  });

  test("transport failure resolves with accepted: false", async () => {
    const result = await exportSpans([], {
      endpoint: "https://collector.test/api/traces",
      fetchImpl: (async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    expect(result.accepted).toBe(false);
    expect(result.status).toBe(0);
  });
});
