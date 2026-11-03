# @est/money

DRAFT (tier k, last audit 2026-11-02)

TS mirror of the `money` crate's `CurrencyAmount`: exact decimal amounts
(BigInt mantissa + scale + currency), the rounding policies
(HalfUp/HalfEven/HalfDown/Floor), and the largest-remainder allocate.
Golden vectors come from the crate's own tests. The Lean-verified
algebra in `accounting-spec` governs the same operations; fixtures
inherited where the proofs state them.

## Truth table

| Concern                                           | Truth                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Allocate (largest remainder, ties by ratio order) | `conformance/money/cases.json` (allocate cases; vectors from money's tests) |
| Rounding policies                                 | `conformance/money/cases.json` (round cases)                                |
| Sign helpers and parse strictness                 | `conformance/money/cases.json`                                              |
| wasm twin                                         | future `crates/money-wasm`, optional behind this TS implementation          |

## Requirements

- REQ-1: `allocate` preserves the total exactly: parts sum to the
  original mantissa at the original scale. Oracle: preservation
  assertion in every allocate test.
- REQ-2: Undistributed minor units go to the largest fractional
  remainders; ties resolve in ratio order. Oracle: fixture `even split
  largest remainder` and `ties break by ratio order`.
- REQ-3: Negative amounts fail closed symmetrically: the euclidean floor
  plus largest-remainder distribution keeps the sum exact, with the
  extra unit landing on the LAST part. Oracle: fixture `negative amount
  sums exactly`.
- REQ-4: Ratios are non-negative integer weights at the max ratio scale,
  gcd-reduced; empty, negative, or all-zero ratio sets are rejected as
  `invalid-amount`. Oracle: fixture error cases.
- REQ-5: Rounding policies match rust_decimal's strategies at halfway
  points: HalfUp away from zero, HalfEven to even, HalfDown toward zero,
  Floor toward negative infinity. Oracle: fixture round cases.
- REQ-6: Parsing is strict decimal (`[sign] digits [. digits]`); anything
  else is `invalid-amount`. Oracle: fixture parse cases.

## Out of scope

`FxRate` conversion (fx.rs) and currency minor-unit metadata (exponents):
both are follow-up surfaces; the alloc/round core is the dogfood target.
The wasm twin mirrors this exact API when built.
