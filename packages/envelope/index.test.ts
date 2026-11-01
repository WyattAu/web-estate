import { describe, expect, test } from "bun:test";
import cases from "../../conformance/envelope/cases.json";
import { decodeEnvelope, envelopeError, envelopePaginated, envelopeSuccess } from "./src/index";

type DecodeCase = {
  kind: "decode";
  name: string;
  input: unknown;
  expect: "ok" | "reject";
  expected?: Record<string, unknown>;
};
type EncodeCase = {
  kind: "encode";
  name: string;
  construct: { code: string; message: string } | { data: unknown };
  expected: Record<string, unknown>;
};
type Case = DecodeCase | EncodeCase;

const suite = cases as { suite: string; cases: Case[] };

describe("conformance: envelope", () => {
  test("fixture suite is envelope", () => {
    expect(suite.suite).toBe("envelope");
  });

  for (const c of suite.cases) {
    if (c.kind === "decode") {
      test(`decode: ${c.name}`, () => {
        const result = decodeEnvelope(c.input);
        if (c.expect === "reject") {
          expect(result.ok).toBe(false);
        } else {
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(JSON.parse(JSON.stringify(result.envelope))).toEqual(c.expected);
          }
        }
      });
    } else {
      test(`encode: ${c.name}`, () => {
        const env =
          "code" in c.construct
            ? envelopeError(c.construct.code, c.construct.message)
            : envelopeSuccess(c.construct.data);
        expect(JSON.parse(JSON.stringify(env))).toEqual(c.expected);
      });
    }
  }

  test("paginated encode matches the Rust constructor shape", () => {
    const env = envelopePaginated([1], { page: 1, per_page: 50, total: 3, total_pages: 1 });
    expect(env.pagination?.per_page).toBe(50);
    expect(env.pagination?.total_pages).toBe(1);
    expect(Object.hasOwn(env, "error")).toBe(false);
  });
});
