// FX conversion, mirroring money/src/fx.rs: FxRate (positive validated,
// identity, inverse), the in-memory provider, and convert (exact
// multiplication; missing rate is an error, not a fallback).

import { MoneyError, type MoneyAmount, type Currency } from "./index";

export interface FxRate {
  from: Currency;
  to: Currency;
  /** rate as mantissa * 10^-scale; always positive. */
  mantissa: bigint;
  scale: number;
}

export function createFxRate(
  from: Currency,
  to: Currency,
  mantissa: bigint,
  scale: number,
): FxRate {
  if (mantissa <= 0n) {
    throw new MoneyError("invalid-amount", "exchange rate must be positive");
  }
  return { from, to, mantissa, scale };
}

export function fxCurrencyIdentity(currency: Currency): FxRate {
  return { from: currency, to: currency, mantissa: 1n, scale: 0 };
}

/**
 * Inverse rate. The Rust crate divides 1/rate at the decimal level
 * (28-significant-digit ceiling); TS mirrors with an explicit target
 * scale using truncated division — document the chosen scale at the
 * call site, since 1/0.85 is not exactly representable.
 */
export function fxInverse(rate: FxRate, targetScale = 28): FxRate {
  const numerator = 10n ** BigInt(targetScale);
  return {
    from: rate.to,
    to: rate.from,
    mantissa: numerator / rate.mantissa,
    scale: targetScale,
  };
}

const key = (from: Currency, to: Currency) => `${from}->${to}`;

export interface FxProvider {
  getRate(from: Currency, to: Currency): FxRate;
  getRatesFrom(from: Currency): FxRate[];
}

/** In-memory provider mirroring InMemoryFxProvider. */
export function createFxProvider(rates: readonly FxRate[] = []): FxProvider & {
  setRate(rate: FxRate): void;
} {
  const table = new Map<string, FxRate>();
  for (const rate of rates) table.set(key(rate.from, rate.to), rate);

  return {
    getRate(from, to) {
      const rate = table.get(key(from, to));
      if (!rate) {
        throw new MoneyError("invalid-amount", `no rate for ${from} -> ${to}`);
      }
      return rate;
    },
    getRatesFrom(from) {
      return [...table.values()].filter((r) => r.from === from);
    },
    setRate(rate) {
      if (rate.mantissa <= 0n) {
        throw new MoneyError("invalid-amount", "exchange rate must be positive");
      }
      table.set(key(rate.from, rate.to), rate);
    },
  };
}

/**
 * Convert across currencies: exact multiplication of mantissas (the
 * Rust convert has no rounding at convert; scales add). Same-currency
 * conversion requires an identity rate in the provider.
 */
export function convert(
  amount: MoneyAmount,
  to: Currency,
  provider: FxProvider,
): MoneyAmount {
  const rate = provider.getRate(amount.currency, to);
  return {
    mantissa: amount.mantissa * rate.mantissa,
    scale: amount.scale + rate.scale,
    currency: to,
  };
}
