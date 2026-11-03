# @est/flags

DRAFT (tier k, last audit 2026-11-01)

Client for the estate's `flagsd` evaluation API. Wire truth lives in
`conformance/flags/cases.json`: the evaluate route mirrors `flagsd`'s
`GET /evaluate/{name}?user=&org= -> {name, enabled}`; the fail-closed
policy is normative here.

## Truth table

| Concern | Truth |
|---|---|
| Evaluate wire shape | `conformance/flags/cases.json` (evaluate cases) |
| Subject query building | `conformance/flags/cases.json` (url cases) |
| Fail-closed policy | `conformance/flags/cases.json` + SPEC REQ-3 |
| Transport/retry | `@est/fetchkit` (`fetchJsonWithMeta`; flagsd predates envelopes) |

## Requirements

- REQ-1: A remote decision always wins when the body parses to a boolean
  `enabled`; `defaults` never override a successful remote answer. Oracle:
  fixture `remote disabled wins over defaults`.
- REQ-2: Any failure (404, malformed body, network) fails closed to
  `defaults[name] ?? false` with `source: "default"`. Oracle: fixture
  evaluate cases.
- REQ-3: Subject params serialize as `user` then `org`, only when present.
  Oracle: fixture url cases.
- REQ-4: Transport retry is inherited from `@est/fetchkit`; this kit adds
  no retry logic of its own. Oracle: type-level (no loop in src).

## Out of scope

Admin routes (auth-token CRUD), change-history streaming, offline caching.
