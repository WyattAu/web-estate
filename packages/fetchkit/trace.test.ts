import { describe, expect, test } from "bun:test";
import cases from "../../conformance/w3c-trace/cases.json";
import { generateTraceContext, isValidTraceparent, parseTraceparent } from "./src/trace";

type Suite = {
  suite: string;
  valid_traceparents: string[];
  invalid_traceparents: { value: string; reason: string }[];
};

const suite = JSON.parse(JSON.stringify(cases)) as Suite;

describe("conformance: w3c-trace", () => {
  test("fixture suite is w3c-trace", () => {
    expect(suite.suite).toBe("w3c-trace");
  });

  for (const tp of suite.valid_traceparents) {
    test(`valid: ${tp.slice(0, 30)}...`, () => {
      expect(isValidTraceparent(tp)).toBe(true);
      const parsed = parseTraceparent(tp);
      expect(parsed?.traceparent).toBe(tp);
    });
  }

  for (const { value, reason } of suite.invalid_traceparents) {
    test(`invalid (${reason})`, () => {
      expect(isValidTraceparent(value)).toBe(false);
      expect(parseTraceparent(value)).toBeNull();
    });
  }

  test("generated contexts are valid and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) {
      const { traceId, spanId, traceparent } = generateTraceContext();
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(isValidTraceparent(traceparent)).toBe(true);
      expect(seen.has(traceparent)).toBe(false);
      seen.add(traceparent);
    }
  });
});
