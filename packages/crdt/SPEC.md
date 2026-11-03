# @est/crdt

DRAFT (tier k, last audit 2026-11-02)

TS mirror of the `crdts-kit` RGA text CRDT: per-character identity
`(site_id, counter)`, origin-based integration with id-skip sibling
ordering, tombstone deletes, and the `CrdtDocument` wrapper (presence,
version counter). Wire truth lives in `conformance/crdt/cases.json`.

## Truth table

| Concern                  | Truth                                                           |
| ------------------------ | --------------------------------------------------------------- |
| Integration algorithm    | `conformance/crdt/cases.json` convergence scenarios             |
| Id total order           | `compareIds` (site-major, then counter) + unit test             |
| Causal delivery contract | lib comment + SPEC REQ-3 (transport's job, not this kit's)      |
| wasm twin                | future `crates/crdt-wasm`, same pattern as `crates/search-wasm` |

## Requirements

- REQ-1: Integration equals the Rust `find_insert_position`: start after
  `origin_left` (or 0), skip nodes whose id is greater than the inserted
  id, insert. Oracle: fixture convergence scenarios under both sync
  orders.
- REQ-2: Concurrent inserts at the same origin converge regardless of
  application order (id-skip tie-break). Oracle: fixture scenarios 1-2.
- REQ-3: Deletes tombstone; concurrent inserts through a tombstoned
  region keep their positions. Oracle: fixture scenario 4.
- REQ-4: The logical clock ratchets to `max(clock, op.id.counter)` on
  apply, and `nextId` increments it (single global clock, as in the Rust
  crate). Oracle: unit tests via op ids in convergence runs.
- REQ-5: `CrdtDocument` versions every local-edit batch and every remote
  ingest by one. Oracle: document unit tests.
- REQ-6: Ops are not deduplicated; the transport must not deliver the
  same op twice (mirrors the crate). Oracle: documented contract; no
  dedupe code exists in src.

## Out of scope

Transport (that is `@est/ws` when it exists), cursor/presence sync beyond
join/leave, and the wasm twin (tracked as `crates/crdt-wasm`, optional
behind this TS implementation).
