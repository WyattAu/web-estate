import { describe, expect, test } from "bun:test";
import { FLAGSD_BASE, flags } from "./src/lib/flags";
import { i18n, LOCALES } from "./src/lib/i18n";

describe("ledger app wiring", () => {
  test("i18n catalogs cover both locales for the labels used", () => {
    const keys = ["alloc.heading", "alloc.amount", "status.heading", "flags.heading"] as const;
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(i18n.translate(locale, key)).not.toBe(key);
      }
    }
    expect(LOCALES).toEqual(["en", "de"]);
  });

  test("flags client fails closed when flagsd is unreachable", async () => {
    const decision = await flags.evaluate("ledger-beta");
    expect(decision.source).toBe("default");
    expect(decision.enabled).toBe(false);
    expect(FLAGSD_BASE).toBeTruthy();
  });
});
