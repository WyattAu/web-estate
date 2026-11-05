// Browser/native artifact parity: the compiled money-wasm module runs
// the shared allocate and round fixtures, including error cases. Skipped
// when pkg/ is absent (built by scripts/build-money-wasm.sh or the CI
// wasm job). Drives the wasm-bindgen glue directly from this package's
// own pkg/ directory.

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import cases from "../../conformance/money/cases.json";

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

type WasmGlue = {
  default: (input?: ArrayBuffer) => Promise<void>;
  allocate_json: (value: string, currency: string, ratios_json: string) => string;
  round_json: (value: string, currency: string, places: number, policy: string) => string;
};

async function loadGlue(): Promise<WasmGlue> {
  // Computed specifier on purpose: the artifact is generated, and bun
  // resolves this relative to THIS test file (package root).
  const spec = "./pkg/money_wasm.js";
  const mod = (await import(spec)) as unknown as WasmGlue;
  const bytes = await Bun.file(join(pkgDir, "money_wasm_bg.wasm")).arrayBuffer();
  await mod.default(bytes);
  return mod;
}

describe("money-wasm artifact parity", () => {
  test.skipIf(!existsSync(join(pkgDir, "money_wasm_bg.wasm")))(
    "allocate matches every fixture vector (incl. error cases)",
    async () => {
      const w = await loadGlue();
      for (const c of suite.allocate_cases) {
        let threw = false;
        let actual: unknown;
        try {
          actual = JSON.parse(w.allocate_json(c.amount, c.currency, JSON.stringify(c.ratios)));
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
    },
  );

  test.skipIf(!existsSync(join(pkgDir, "money_wasm_bg.wasm")))(
    "round matches every fixture vector",
    async () => {
      const w = await loadGlue();
      for (const c of suite.round_cases) {
        expect(w.round_json(c.amount, c.currency, c.places, c.policy)).toBe(c.expected);
      }
    },
  );
});
