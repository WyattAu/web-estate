// @est/money: TS mirror of the money crate's CurrencyAmount.
// Exact decimal arithmetic over BigInt mantissas; the allocate algorithm
// mirrors src/amount.rs op for op (largest remainder, euclidean floors).
// Wire truth: conformance/money/cases.json (vectors from the crate's own
// tests). The wasm twin is a future optional enhancement (crates/money-wasm
// pattern); BigInt is exact, so the TS implementation is canonical here.

export class MoneyError extends Error {
  readonly kind: "invalid-amount" | "overflow";
  constructor(kind: "invalid-amount" | "overflow", reason: string) {
    super(reason);
    this.name = "MoneyError";
    this.kind = kind;
  }
}

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "CNY",
  "INR",
  "BRL",
  "KRW",
  "MXN",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RUB",
  "ZAR",
  "SGD",
  "HKD",
  "NZD",
  "THB",
  "TRY",
  "AED",
  "SAR",
  "NGN",
  "EGP",
  "PHP",
  "IDR",
  "MYR",
  "VND",
  "PKR",
  "BDT",
  "BTC",
  "ETH",
  "ILS",
  "TWD",
  "ARS",
  "CLP",
  "COP",
  "PEN",
] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(code: string): code is Currency {
  return (CURRENCIES as readonly string[]).includes(code);
}

export interface MoneyAmount {
  /** Exact value: mantissa * 10^-scale. BigInt, i128-range in practice. */
  readonly mantissa: bigint;
  readonly scale: number;
  readonly currency: Currency;
}

/** Parse a decimal string ("100.00", "-2.5", "34") into an amount. */
export function parseMoney(amount: string, currency: Currency): MoneyAmount {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount.trim());
  if (!match) throw new MoneyError("invalid-amount", `not a decimal: ${amount}`);
  const [, sign, intPart, fracPart = ""] = match;
  const digits = (intPart ?? "0") + fracPart;
  const mantissa = BigInt((sign ?? "") + digits);
  return { mantissa, scale: fracPart.length, currency };
}

/** Render an amount as its decimal string, preserving scale. */
export function moneyToString(a: MoneyAmount): string {
  const digits = a.mantissa.toString().replace("-", "");
  const padded = digits.padStart(a.scale + 1, "0");
  const intPart = padded.slice(0, padded.length - a.scale) || "0";
  const fracPart = a.scale > 0 ? `.${padded.slice(padded.length - a.scale)}` : "";
  return `${a.mantissa < 0n ? "-" : ""}${intPart}${fracPart}`;
}

function toDecimalString(mantissa: bigint, scale: number): string {
  return moneyToString({ mantissa, scale, currency: "USD" });
}

function isZero(a: MoneyAmount): boolean {
  return a.mantissa === 0n;
}

function isPositive(a: MoneyAmount): boolean {
  return a.mantissa > 0n;
}

function isNegative(a: MoneyAmount): boolean {
  return a.mantissa < 0n;
}

function absMoney(a: MoneyAmount): MoneyAmount {
  return { ...a, mantissa: a.mantissa < 0n ? -a.mantissa : a.mantissa };
}

function negateMoney(a: MoneyAmount): MoneyAmount {
  return { ...a, mantissa: -a.mantissa };
}

function sameCurrency(a: MoneyAmount, b: MoneyAmount): void {
  if (a.currency !== b.currency) {
    throw new MoneyError("invalid-amount", `currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

/** Align two amounts to the larger scale; exact (scale shift by 10s). */
function aligned(a: MoneyAmount, b: MoneyAmount): [bigint, bigint, number] {
  sameCurrency(a, b);
  const scale = Math.max(a.scale, b.scale);
  const aUp = a.mantissa * 10n ** BigInt(scale - a.scale);
  const bUp = b.mantissa * 10n ** BigInt(scale - b.scale);
  return [aUp, bUp, scale];
}

export function addMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  const [x, y, scale] = aligned(a, b);
  return { mantissa: x + y, scale, currency: a.currency };
}

export function subtractMoney(a: MoneyAmount, b: MoneyAmount): MoneyAmount {
  const [x, y, scale] = aligned(a, b);
  return { mantissa: x - y, scale, currency: a.currency };
}

/** Euclidean division for BigInt (b > 0): floor, non-negative remainder. */
function divEuclid(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  return r < 0n ? (b > 0n ? q - 1n : q + 1n) : q;
}

function remEuclid(a: bigint, b: bigint): bigint {
  const r = a % b;
  return r < 0n ? ((r % b) + b) % b : r;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export type RoundingPolicy = "HalfUp" | "HalfEven" | "HalfDown" | "Floor";

/** Round to `places`, mirroring rust_decimal's strategy behaviors. */
export function roundTo(
  a: MoneyAmount,
  places: number,
  policy: RoundingPolicy = "HalfEven",
): MoneyAmount {
  const diff = a.scale - places;
  if (diff <= 0) return { ...a };
  const div = 10n ** BigInt(diff);
  const negative = a.mantissa < 0n;
  const magnitude = negative ? -a.mantissa : a.mantissa;

  let truncated = magnitude / div;
  const rem = magnitude % div;

  // Floor: toward negative infinity, regardless of the fraction.
  if (policy === "Floor") {
    const floored = rem !== 0n && negative ? truncated + 1n : truncated;
    return { mantissa: negative ? -floored : floored, scale: places, currency: a.currency };
  }

  const twice = rem * 2n;
  let roundAway = false;
  if (twice > div) roundAway = true;
  else if (twice === div) {
    if (policy === "HalfUp") roundAway = true;
    else if (policy === "HalfEven") roundAway = truncated % 2n !== 0n;
    // HalfDown: halfway stays truncated.
  }

  if (roundAway) truncated += 1n;
  const mantissa = negative ? -truncated : truncated;
  return { mantissa, scale: places, currency: a.currency };
}

/** `round()` in the crate: HalfEven to the amount's own scale is a no-op;
 * the meaningful default is banker's rounding to 2 places (retail scale). */
export function round(a: MoneyAmount, places = 2): MoneyAmount {
  return roundTo(a, places, "HalfEven");
}

/**
 * Split into parts proportional to `ratios`, summing exactly to the
 * original (largest remainder; ties broken by ratio order). Mirrors
 * CurrencyAmount::allocate, including gcd reduction and euclidean floors.
 */
export function allocate(
  a: MoneyAmount,
  ratios: readonly { mantissa: bigint; scale: number }[],
): MoneyAmount[] {
  if (ratios.length === 0) {
    throw new MoneyError("invalid-amount", "allocation requires at least one ratio");
  }
  const weightScale = Math.max(...ratios.map((r) => r.scale));
  const weights: bigint[] = ratios.map((r) => {
    if (r.mantissa < 0n) {
      throw new MoneyError("invalid-amount", `allocation ratios must not be negative`);
    }
    return r.mantissa * 10n ** BigInt(weightScale - r.scale);
  });
  let totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  if (totalWeight === 0n) {
    throw new MoneyError("invalid-amount", "allocation ratios must not all be zero");
  }
  const common = weights.reduce((acc, w) => gcd(acc, w), totalWeight);
  if (common > 1n) {
    weights.forEach((w, i) => {
      weights[i] = w / common;
    });
    totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  }

  const floors: bigint[] = [];
  const remainders: bigint[] = [];
  let allocated = 0n;
  for (const w of weights) {
    const raw = a.mantissa * w;
    const floored = divEuclid(raw, totalWeight);
    floors.push(floored);
    remainders.push(remEuclid(raw, totalWeight));
    allocated += floored;
  }

  const leftover = a.mantissa - allocated;
  const order = remainders
    .map((r, idx) => ({ idx, r }))
    .sort((x, y) => {
      if (y.r !== x.r) return y.r > x.r ? 1 : -1;
      return x.idx - y.idx; // stable ties in ratio order
    });
  const parts = [...floors];
  const distribute = leftover > 0n ? Number(leftover) : 0;
  for (let i = 0; i < distribute; i++) {
    const idx = order[i]?.idx;
    const part = idx === undefined ? undefined : parts[idx];
    if (part !== undefined) parts[idx] = part + 1n;
  }

  return parts.map((part) => ({
    mantissa: part,
    scale: a.scale,
    currency: a.currency,
  }));
}

/** Convenience: allocate from decimal ratio strings ("1", "0.5", ...). */
export function allocateStrings(a: MoneyAmount, ratios: readonly string[]): MoneyAmount[] {
  return allocate(
    a,
    ratios.map((r) => {
      const m = parseMoney(r, a.currency);
      return { mantissa: m.mantissa, scale: m.scale };
    }),
  );
}

export { absMoney as abs, isNegative, isPositive, isZero, negateMoney as negate, toDecimalString };
