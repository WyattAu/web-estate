// Browser-artifact parity: the compiled wasm module runs the shared
// allocate and round fixtures. Skipped when pkg/ is absent (built by
// `wasm-pack build` in the CI wasm job).

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
const artifact = join(pkgDir, "money_wasm_bg.wasm");

type WasmGlue = {
  default: (input?: ArrayBuffer) => Promise<void>;
  allocate_json: (value: string, currency: string, ratios_json: string) => string;
  round_json: (value: string, currency: string, places: number, policy: string) => string;
};

let glue: WasmGlue | null = null;

async function loadGlue(): Promise<WasmGlue> {
  const mod = (await import("../pkg/money_wasm.js")) as unknown as WasmGlue;
  const bytes = await Bun.file(artifact).arrayBuffer();
  await mod.default(bytes);
  return mod;
}

const hasArtifact = existsSync(artifact);
const load = (): Promise<WasmGlue> => (glue ??= loadGlue());

describe("money-wasm browser artifact", () => {
  test.skipIf(!hasArtifact)("instantiates from the built artifact", async () => {
    expect((await load()).allocate_json).toBeFunction();
  });

  test.skipIf(!hasArtifact)("allocate matches every fixture vector", async () => {
    const w = await load();
    for (const c of suite.allocate_cases) {
      let actual: unknown;
      try {
        actual = JSON.parse(w.allocate_json(c.amount, c.currency, JSON.stringify(c.ratios)));
      } catch {
        actual = { error: true };
      }
      if (c.error) {
        expect("error" in (actual as object)).toBe(true);
      } else {
        expect(actual).toEqual(c.expected);
      }
    }
  });

  test.skipIf(!hasArtifact)("round matches every fixture vector", async () => {
    const w = await load();
    for (const c of suite.round_cases) {
      expect(w.round_json(c.amount, c.currency, c.places, c.policy)).toBe(c.expected);
    }
  });
});
