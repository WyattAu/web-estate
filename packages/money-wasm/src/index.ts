// @est/money-wasm: wasm twin of @est/money, wrapping the published
// decimal-money crate compiled to wasm. Same fixture corpus as the TS
// kit. The artifact under pkg/ is built by scripts/build-money-wasm.sh;
// loading throws when absent — callers stay on the TS twin.

export type { MoneyAmount, RoundingPolicy, Currency } from "@est/money";

type WasmGlue = {
  default: (input?: ArrayBuffer) => Promise<void>;
  allocate_json: (value: string, currency: string, ratios_json: string) => string;
  round_json: (value: string, currency: string, places: number, policy: string) => string;
};

let glue: Promise<WasmGlue> | null = null;

async function loadGlue(artifact?: ArrayBuffer): Promise<WasmGlue> {
  const spec = "../pkg/money_wasm.js";
  const mod = (await import(spec)) as unknown as WasmGlue;
  if (artifact !== undefined) {
    await mod.default(artifact);
  } else {
    await mod.default();
  }
  return mod;
}

/** Initialize from explicit bytes (Bun/Node) or the default URL fetch. */
export async function initWasm(artifact?: ArrayBuffer): Promise<WasmGlue> {
  glue ??= loadGlue(artifact);
  return glue;
}

/**
 * Allocate via wasm. `artifact` lets loaders hand the compiled bytes in
 * explicitly (recommended in Bun); omit to let the glue fetch by URL.
 * Throws MoneyError-shaped strings on invalid input (the crate's errors).
 */
export async function allocateWasm(
  value: string,
  currency: string,
  ratios: readonly string[],
  artifact?: ArrayBuffer,
): Promise<string[]> {
  const mod = await initWasm();
  const json = JSON.stringify(ratios);
  return JSON.parse(mod.allocate_json(value, currency, json)) as string[];
}

/** Round via wasm (policies: HalfUp | HalfEven | HalfDown | Floor). */
export async function roundWasm(
  value: string,
  currency: string,
  places: number,
  policy: string,
  artifact?: ArrayBuffer,
): Promise<string> {
  const mod = await initWasm();
  return mod.round_json(value, currency, places, policy);
}
