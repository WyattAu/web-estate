import { describe, expect, test } from "bun:test";
import { allocateWasm, roundWasm } from "./src/index";

describe("@est/money-wasm module contract", () => {
  test("allocateWasm throws MoneyError-shaped strings on invalid ratios", async () => {
    const artifact = new Bun.file(new URL("../pkg/money_wasm_bg.wasm", import.meta.url));
    const bytes = await artifact.arrayBuffer();
    expect(async () => await allocateWasm("10.00", "USD", ["-1", "2"], bytes)).toThrow();
    expect(async () => await allocateWasm("10.00", "USD", ["0", "0"], bytes)).toThrow();
  });

  test("roundWasm returns the decimal string", async () => {
    const bytes = await Bun.file(new URL("../pkg/money_wasm_bg.wasm", import.meta.url)).arrayBuffer();
    const got = await roundWasm("2.5", "USD", 0, "HalfEven", bytes);
    expect(got).toBe("2");
  });
});
