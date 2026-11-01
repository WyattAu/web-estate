# @est/search

DRAFT (tier k, last audit 2026-11-01)

Client-side scored text search over corpora of hundreds to low thousands of
documents. The TS implementation (`TsSearchIndex`) is the reference. The
Rust crate `crates/search-wasm` is an optional enhancement implementing the
same ABI and passing the same fixture file; the TS side always ships, the
wasm side only when built.

## Truth table

| Concern | Truth |
|---|---|
| Scoring and ordering semantics | `conformance/search/cases.json` |
| Tokenization rule | `conformance/search/cases.json` + unit test |
| Index ABI | `src/index.ts` (`SearchIndex`) |
| wasm twin | `crates/search-wasm/src/lib.rs` |

## Requirements

- REQ-1: `tokenize` lowercases and splits on non-alphanumeric runs.
  Oracle: fixture `tokenize` unit test.
- REQ-2: Ordering is score desc, then id asc for determinism. Oracle:
  fixture `relaxing` and `city builder` cases.
- REQ-3: Empty and no-match queries return `[]`. Oracle: fixture cases.
- REQ-4: Duplicate ids and post-build adds are errors. Oracle: unit tests.
- REQ-5: The wasm twin (when built) passes this same fixture file with
  identical expectations. Oracle: `cargo test` in `crates/search-wasm`.

## Scoring table (normative)

| Signal | Weight |
|---|---|
| title equals query | 6 |
| title starts with query | 4 |
| title word equals query | 3 |
| title word starts with query | 1.5 |
| tag equals or contains query | 2 |
| description contains query | 1 |
