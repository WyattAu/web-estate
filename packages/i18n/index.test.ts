import { describe, expect, test } from "bun:test";
import cases from "../../conformance/i18n/cases.json";
import {
  createI18n,
  InvalidLocaleError,
  localeLanguage,
  normalizeLocale,
  pluralForCount,
  pluralWithZero,
} from "./src/index";

type NormalizeCase = { kind: "normalize"; input: string; expected: string };
type NormalizeInvalidCase = { kind: "normalize_invalid"; input: string; reason: string };
type PluralCase = {
  kind: "plural";
  rule: "for_count" | "with_zero";
  count: number;
  expected_suffix: string;
};
type TranslateCase = {
  kind: "translate";
  name: string;
  locale: string;
  key: string;
  params?: Record<string, string>;
  expected: string;
};
type ExistsCase = { kind: "exists"; locale: string; key: string; expected: boolean };
type Case = NormalizeCase | NormalizeInvalidCase | PluralCase | TranslateCase | ExistsCase;

const suite = cases as unknown as {
  suite: string;
  catalog: Record<string, Record<string, string>>;
  default_locale: string;
  cases: Case[];
};

const i18n = createI18n(suite.catalog, suite.default_locale);

describe("conformance: i18n", () => {
  test("fixture suite is i18n", () => {
    expect(suite.suite).toBe("i18n");
  });

  for (const c of suite.cases) {
    if (c.kind === "normalize") {
      test(`normalize ${c.input} -> ${c.expected}`, () => {
        expect(normalizeLocale(c.input)).toBe(c.expected);
      });
    } else if (c.kind === "normalize_invalid") {
      test(`normalize rejects ${c.reason}: "${c.input}"`, () => {
        expect(() => normalizeLocale(c.input)).toThrow(InvalidLocaleError);
      });
    } else if (c.kind === "plural") {
      test(`plural ${c.rule}(${c.count}) -> ${c.expected_suffix}`, () => {
        const suffix = c.rule === "for_count" ? pluralForCount(c.count) : pluralWithZero(c.count);
        expect(String(suffix)).toBe(c.expected_suffix);
      });
    } else if (c.kind === "translate") {
      test(`translate: ${c.name}`, () => {
        expect(i18n.translate(c.locale, c.key, c.params)).toBe(c.expected);
      });
    } else {
      test(`exists ${c.locale}/${c.key} -> ${c.expected}`, () => {
        expect(i18n.exists(c.locale, c.key)).toBe(c.expected);
      });
    }
  }

  test("localeLanguage returns the primary subtag", () => {
    expect(localeLanguage("en-GB")).toBe("en");
    expect(localeLanguage("de")).toBe("de");
  });

  test("catalog accessors report locales and key counts", () => {
    expect(i18n.catalog.locales().sort()).toEqual(["de", "de-DE", "en", "en-GB"]);
    expect(i18n.catalog.keyCount("en")).toBe(5);
  });

  test("translatePlural picks the suffix and injects count", () => {
    expect(i18n.translatePlural("en", "items", 1)).toBe("1 item");
    expect(i18n.translatePlural("en", "items", 3)).toBe("3 items");
    expect(i18n.translatePlural("en", "items", 0)).toBe("0 items");
  });
});
