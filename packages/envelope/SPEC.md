# @est/envelope

DRAFT (tier k, last audit 2026-11-01)

TS mirror of the `json-envelope` crate: the `ApiResponse` wire shape,
`ApiError`, and `PaginationMeta`. Wire truth lives in
`conformance/envelope/cases.json`; the Rust crate should adopt the same
fixture file. The fixture is this SPEC's executable oracle.

## Truth table

| Concern | Truth |
|---|---|
| Envelope wire shape, decode strictness | `conformance/envelope/cases.json` |
| Public API | `src/index.ts` |

## Requirements

- REQ-1: Wire keys are snake_case (`per_page`, `total_pages`); camelCase
  pagination is rejected on decode. Oracle: fixture `camelCase pagination
  key is rejected on the wire`.
- REQ-2: `success:false` requires an `error` object; `success:true` with an
  `error` object is rejected; `success` must be a boolean. Oracle: fixture
  decode cases.
- REQ-3: Absent optional keys are omitted, never null (serde
  `skip_serializing_if`). Oracle: fixture encode cases.
- REQ-4: Error codes flow from `@est/errcode`, so the two kits cannot
  drift. Oracle: `envelopeError` unit test plus errcode fixtures.

## Consumers

`apps/directory` wraps search result pages in paginated envelopes
(REQ-1 shape) via the Solid island.
