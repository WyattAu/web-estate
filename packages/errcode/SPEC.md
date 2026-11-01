# @est/errcode

DRAFT (tier k, last audit 2026-11-01)

TS mirror of the `errcode` crate: the 10-variant error code table, RFC 7807
`ProblemDetail`, and the Rust Display format. Wire truth lives in
`conformance/errcode/cases.json`; the Rust crate passes the same fixture
file. This SPEC defers to that fixture as its executable oracle.

## Truth table

| Concern                             | Truth                                            |
| ----------------------------------- | ------------------------------------------------ |
| Status/code/reason/typeUri mappings | `conformance/errcode/cases.json`                 |
| ProblemDetail wire shape            | `conformance/errcode/cases.json` (problem cases) |
| Public API                          | `src/index.ts`                                   |

## Requirements

- REQ-1: The mapping table equals the fixture, cell for cell. Oracle:
  `bun test packages/errcode` (fixture-driven).
- REQ-2: `ProblemDetail` omits `detail`/`instance` keys when absent,
  matching serde `skip_serializing_if`. Oracle: fixture `problem` cases.
- REQ-3: `display()` returns `"{reason} ({status})"`. Oracle: fixture
  `display` cases.
- REQ-4: The fixture covers all 10 variants. Oracle: coverage test in
  `index.test.ts`.

## Out of scope

HTTP response construction (that is `@est/envelope` plus app concerns) and
i18n of reason phrases.
