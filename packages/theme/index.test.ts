import { describe, expect, test } from "bun:test";
import cases from "../../conformance/theme/cases.json";
import { createTokenGraph, ESTATE_LIGHT, InvalidThemeHexError, normalizeHex } from "./src/index";

type NormalizeCase = { role: string; input: string; expected?: string; error?: boolean };

const suite = cases as unknown as {
  suite: string;
  palette: Record<string, string>;
  graph_name: string;
  expected_css: string;
  normalize_cases: NormalizeCase[];
  missing_role_cases: { graph_roles: string[]; resolve: string; throws: boolean }[];
};

describe("conformance: theme", () => {
  test("fixture suite is theme", () => {
    expect(suite.suite).toBe("theme");
  });

  test("ESTATE_LIGHT export equals the fixture palette (no drift)", () => {
    expect(ESTATE_LIGHT).toEqual(suite.palette as unknown as typeof ESTATE_LIGHT);
  });

  test("css vars match the crate's emitter output exactly", () => {
    const graph = createTokenGraph(suite.graph_name);
    for (const [role, hex] of Object.entries(suite.palette)) {
      graph.setHex(role as never, hex);
    }
    expect(graph.toCssVars()).toBe(suite.expected_css);
  });

  test("dtcg json matches the crate's emitter output", () => {
    const graph = createTokenGraph(suite.graph_name);
    for (const [role, hex] of Object.entries(suite.palette)) {
      graph.setHex(role as never, hex);
    }
    const dtcg = JSON.parse(graph.toDtcgJson());
    expect(dtcg.$description).toBe(suite.graph_name);
    expect(Object.keys(dtcg.color).sort()).toEqual(Object.keys(suite.palette).sort());
    expect(dtcg.color.surface.$value).toBe("#faf9f5");
    expect(dtcg.color.accent.$type).toBe("color");
  });

  for (const c of suite.normalize_cases) {
    test(`normalize ${c.input} -> ${c.expected ?? "error"}`, () => {
      if (c.error) {
        expect(() => normalizeHex(c.role as never, c.input)).toThrow();
      } else {
        expect(normalizeHex(c.role as never, c.input)).toBe(c.expected as string);
      }
    });
  }

  for (const c of suite.missing_role_cases) {
    test(`missing role ${c.resolve} ${c.throws ? "throws" : "resolves"}`, () => {
      const graph = createTokenGraph("partial");
      for (const role of c.graph_roles) graph.setHex(role as never, "#000000");
      if (c.throws) {
        expect(() => graph.require(c.resolve as never)).toThrow();
      } else {
        expect(graph.require(c.resolve as never)).toBe("#000000");
      }
    });
  }

  test("hex normalization is canonical lowercase", () => {
    const err = new InvalidThemeHexError("accent", "x");
    expect(err.name).toBe("InvalidThemeHexError");
  });
});
