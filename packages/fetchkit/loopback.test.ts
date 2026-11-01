// Loopback integration: real fetch, real server, real backoff timing.
// Complements the fixture flows (which inject fetch for determinism).

import { describe, expect, test } from "bun:test";
import { createFetchKit } from "./src/index";

describe("fetchkit loopback", () => {
  test("real HTTP round trip: 500 then 200 with envelope decode", async () => {
    let hits = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        hits++;
        if (hits < 2) {
          return new Response(
            JSON.stringify({ success: false, error: { code: "INTERNAL", message: "boom" } }),
            {
              status: 500,
            },
          );
        }
        return Response.json({ success: true, data: { hello: "estate" } });
      },
    });
    try {
      const kit = createFetchKit({
        retry: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5, jitter: false },
      });
      const out = await kit.fetchEnvelopeWithMeta<{ hello: string }>(new URL("/", server.url).href);
      expect(hits).toBe(2);
      expect(out.attempts).toBe(2);
      expect(out.envelope.success).toBe(true);
      expect(out.envelope.data?.hello).toBe("estate");
    } finally {
      server.stop(true);
    }
  });

  test("429 retries exhaust and surface RATE_LIMITED", async () => {
    let hits = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        hits++;
        return new Response("rate limited", { status: 429 });
      },
    });
    try {
      const kit = createFetchKit({
        retry: { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 5, jitter: false },
      });
      const out = await kit.fetchEnvelopeWithMeta(new URL("/", server.url).href);
      expect(hits).toBe(3);
      expect(out.attempts).toBe(3);
      expect(out.exhausted).toBe(true);
      expect(out.envelope.success).toBe(false);
      expect(out.envelope.error?.code).toBe("RATE_LIMITED");
    } finally {
      server.stop(true);
    }
  });
});
