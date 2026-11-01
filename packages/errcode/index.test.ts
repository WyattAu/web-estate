import { describe, expect, test } from "bun:test";
import cases from "../../conformance/errcode/cases.json";
import { display, errcode, ERROR_CODE_NAMES, makeProblem } from "./src/index";

type Case =
  | { kind: "code"; variant: string; status: number; code: string; reason: string; typeUri: string }
  | { kind: "display"; variant: string; expected: string }
  | {
      kind: "problem";
      variant: string;
      detail?: string;
      instance?: string;
      expected: Record<string, unknown>;
    };

const suite = cases as { suite: string; cases: Case[] };

describe("conformance: errcode", () => {
  test("fixture suite is errcode", () => {
    expect(suite.suite).toBe("errcode");
  });

  for (const c of suite.cases) {
    if (c.kind === "code") {
      test(`code ${c.variant}`, () => {
        const def = errcode(c.variant as never);
        expect(def.status).toBe(c.status);
        expect(def.code).toBe(c.code);
        expect(def.reason).toBe(c.reason);
        expect(def.typeUri).toBe(c.typeUri);
      });
    } else if (c.kind === "display") {
      test(`display ${c.variant}`, () => {
        expect(display(c.variant as never)).toBe(c.expected);
      });
    } else {
      test(`problem ${c.variant}${c.detail ? " with detail" : ""}`, () => {
        const problem = makeProblem(c.variant as never, {
          detail: c.detail,
          instance: c.instance,
        });
        // Exact wire shape: optional keys omitted when absent (serde skip_serializing_if).
        expect(JSON.parse(JSON.stringify(problem))).toEqual(c.expected);
      });
    }
  }

  test("fixture covers all 10 variants", () => {
    const covered = new Set(
      suite.cases.filter((c) => c.kind === "code").map((c) => c.variant),
    );
    expect([...covered].sort()).toEqual([...ERROR_CODE_NAMES].sort());
  });
});
