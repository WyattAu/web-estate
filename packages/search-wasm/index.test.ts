import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import cases from "../../conformance/search/cases.json";
import { indexDocsWasm } from "./src/index";

type Case = { kind: "query"; query: string; limit: number; expected: string[] };
const suite = cases as {
  suite: string;
  docs: { id: string; title: string; tags: string[]; description: string }[];
  cases: Case[];
};

const artifact = join(import.meta.dir, "pkg", "search_wasm_bg.wasm");

describe("conformance: search-wasm", () => {
  test.skipIf(!existsSync(artifact))("wasm twin passes the search fixtures", async () => {
    const index = await indexDocsWasm(suite.docs);
    for (const c of suite.cases) {
      const hits = index.search(c.query, c.limit);
      expect(hits.map((h) => h.id)).toEqual(c.expected);
    }
  });

  test("artifact presence is decided by scripts/build-wasm.sh, not this test", () => {
    // Documents the skip contract: CI's wasm job builds the artifact;
    // checkouts without it run the TS twin conformance only.
    expect(typeof existsSync(artifact)).toBe("boolean");
  });
});
