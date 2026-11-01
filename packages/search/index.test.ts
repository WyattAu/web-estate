import { describe, expect, test } from "bun:test";
import cases from "../../conformance/search/cases.json";
import { indexDocs, tokenize, type SearchDoc } from "./src/index";

type Case = { kind: "query"; query: string; limit: number; expected: string[] };
const suite = cases as { suite: string; docs: SearchDoc[]; cases: Case[] };

describe("conformance: search", () => {
  const index = indexDocs(suite.docs);

  test("fixture suite is search", () => {
    expect(suite.suite).toBe("search");
  });

  test("index size matches fixture docs", () => {
    expect(index.size).toBe(suite.docs.length);
  });

  for (const c of suite.cases) {
    test(`query "${c.query}"`, () => {
      const hits = index.search(c.query, c.limit);
      expect(hits.map((h) => h.id)).toEqual(c.expected);
    });
  }

  test("tokenize splits on non-alphanumeric and lowercases", () => {
    expect(tokenize("Little Alchemy-2!")).toEqual(["little", "alchemy", "2"]);
    expect(tokenize("")).toEqual([]);
  });

  test("duplicate ids are rejected", () => {
    const idx = indexDocs([{ id: "a", title: "A" }]);
    expect(() => idx.add({ id: "a", title: "A2" })).toThrow(/duplicate id/);
  });

  test("add after build is rejected", () => {
    const idx = indexDocs([{ id: "a", title: "A" }]);
    expect(() => idx.add({ id: "b", title: "B" })).toThrow(/already built/);
  });
});
