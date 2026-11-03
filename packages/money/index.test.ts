import { describe, expect, test } from "bun:test";
import cases from "../../conformance/money/cases.json";
import {
  abs,
  allocateStrings,
  isNegative,
  isZero,
  MoneyError,
  moneyToString,
  negate,
  parseMoney,
  type RoundingPolicy,
  roundTo,
} from "./src/index";

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
type SignCase = { amount: string; currency: string; op: string; expected: string | boolean };
type ParseErrorCase = { amount: string; currency: string };

const suite = cases as unknown as {
  suite: string;
  allocate_cases: AllocateCase[];
  round_cases: RoundCase[];
  sign_cases: SignCase[];
  parse_error_cases: ParseErrorCase[];
};

describe("conformance: money", () => {
  test("fixture suite is money", () => {
    expect(suite.suite).toBe("money");
  });

  for (const c of suite.allocate_cases) {
    test(`allocate: ${c.name}`, () => {
      const total = parseMoney(c.amount, "USD");
      let parts: ReturnType<typeof allocateStrings>;
      try {
        parts = allocateStrings(total, c.ratios);
        if (c.error) throw new Error(`expected ${c.error} error, got result`);
      } catch (e) {
        if (e instanceof MoneyError && c.error) {
          expect(String(e.kind)).toBe(c.error);
          return;
        }
        throw e;
      }
      expect(parts.map((p) => moneyToString(p))).toEqual(c.expected ?? []);
      // Preservation invariant: parts sum exactly to the original.
      const sum = parts.reduce((acc, p) => acc + p.mantissa, 0n);
      expect(sum).toBe(total.mantissa);
    });
  }

  for (const c of suite.round_cases) {
    test(`round ${c.amount} to ${c.places} (${c.policy}) -> ${c.expected}`, () => {
      const rounded = roundTo(parseMoney(c.amount, "USD"), c.places, c.policy as RoundingPolicy);
      expect(moneyToString(rounded)).toBe(c.expected);
    });
  }

  for (const c of suite.sign_cases) {
    test(`${c.op} of ${c.amount}`, () => {
      const a = parseMoney(c.amount, "USD");
      const expected = c.expected as string | boolean;
      if (c.op === "abs") expect(moneyToString(abs(a))).toBe(expected as string);
      else if (c.op === "negate") expect(moneyToString(negate(a))).toBe(expected as string);
      else if (c.op === "is_negative") expect(isNegative(a)).toBe(expected as boolean);
      else if (c.op === "is_zero") expect(isZero(a)).toBe(expected as boolean);
    });
  }

  for (const c of suite.parse_error_cases) {
    test(`parse rejects "${c.amount}"`, () => {
      expect(() => parseMoney(c.amount, "USD")).toThrow(MoneyError);
    });
  }

  test("cross-currency arithmetic is rejected", () => {
    const usd = parseMoney("1.00", "USD");
    const eur = parseMoney("1.00", "EUR");
    expect(() => allocateStrings(eur, [])).toThrow(MoneyError);
    expect(usd.currency).toBe("USD");
    expect(eur.currency).toBe("EUR");
  });
});
