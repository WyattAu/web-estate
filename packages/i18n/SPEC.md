# @est/i18n

DRAFT (tier k, last audit 2026-11-01)

TS mirror of the `i18n-kit` crate: BCP 47 locale normalization, the
catalog (locale -> key -> value, dot-notation keys), English-style plural
suffixes (`zero`/`one`/`other`), and the translator fallback chain with
`{placeholder}` interpolation. Wire truth lives in
`conformance/i18n/cases.json`; the Rust crate should adopt the same
fixture file.

## Truth table

| Concern                           | Truth                                           |
| --------------------------------- | ----------------------------------------------- |
| Locale normalization + validation | `conformance/i18n/cases.json` (normalize cases) |
| Plural rules and suffixes         | `conformance/i18n/cases.json` (plural cases)    |
| Fallback chain and interpolation  | `conformance/i18n/cases.json` (translate cases) |
| Public API                        | `src/index.ts`                                  |

## Requirements

- REQ-1: Normalization equals `Locale::normalize`: language lowercase,
  4-letter subtags Titlecase, 2-letter or digit subtags uppercase, other
  subtags unchanged; validation rejects empty, >35 chars, non-ASCII
  alphanumerics, and language subtags outside 2-3 lowercase letters.
  Oracle: fixture normalize cases.
- REQ-2: `for_count` is English-style (1 -> one, else other);
  `with_zero` adds 0 -> zero; suffixes are `zero`/`one`/`other`.
  Oracle: fixture plural cases.
- REQ-3: Translate fallback chain is exact locale, then primary language
  subtag, then the default locale only when its language differs, then
  the key itself. Oracle: fixture translate cases.
- REQ-4: Interpolation replaces `{name}` slots with params; an unmatched
  well-formed slot becomes the empty string; a brace with no closer stays
  literal. Oracle: fixture translate cases (unmatched + unclosed).
- REQ-5: `translatePlural` composes `pluralWithZero` with
  `keyBase.suffix` and injects `count` as a param. Oracle: unit test.

## Out of scope

Message-format ICU syntax, lazy catalog loading, server-side negotiation
(Negotiator headers); those belong to apps.
