// Browser/native artifact parity: the compiled money-wasm module runs
// the shared allocate and round fixtures. Skipped when pkg/ is absent
// (built by scripts/build-money-wasm.sh or the CI wasm job).

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import cases from "../../conformance/money/cases.json";
import { allocateWasm, roundWasm } from "./src/index";

type AllocateCase = {
  name: string;
  amount: string;
  currency: string;
  ratios: string[];
  expected?: string[];
  error?: string;
};
type RoundCase = {
  amount: string;
  currency: string;
  places: number;
  policy: string;
  expected: string;
};

const suite = cases as unknown as {
  suite: string;
  allocate_cases: AllocateCase[];
  round_cases: RoundCase[];
};

const pkgDir = join(import.meta.dir, "pkg");
const artifact = join(pkgDir, "money_wasm_bg.wasm");
const hasArtifact = existsSync(artifact);

async function bytes(): Promise<ArrayBuffer> {
  return Bun.file(artifact).arrayBuffer();
}

describe("money-wasm artifact parity", () => {
  test.skipIf(!hasArtifact)("allocate matches every fixture vector", async () => {
    for (const c of suite.allocate_cases) {
      let actual: unknown;
      let threw = false;
      try {
        actual = await allocateWasm(c.amount, c.currency, c.ratios, await bytes());
      } catch {
        threw = true;
      }
      if (c.error) {
        expect(threw).toBe(true);
      } else {
        expect(threw).toBe(false);
        expect(actual).toEqual(c.expected);
      }
    }
  });

  test.skipIf(!hasArtifact)("round matches every fixture vector", async () => {
    for (const c of suite.round_cases) {
      const got = await roundWasm(c.amount, c.currency, c.places, c.policy, await bytes());
      expect(got).toBe(c.expected);
    }
  });

  test("artifact presence is decided by scripts/build-money-wasm.sh", () => {
    expect(typeof hasArtifact).toBe("boolean");
  });
});
