# web-estate

The WyattAu web frontend estate: TS + SolidJS + Astro + Starlight under Bun,
with optional custom wasm for pure logic and hot paths. It applies the Rust
kit-estate constitution to the browser: small kits, exact pins, a registry of
record, golden conformance fixtures, and consumer suites that compose kits
without owning business logic.

## Status

DRAFT; scaffolded 2026-11-01. Three kits (`@est/errcode`, `@est/envelope`,
`@est/search`), one wasm crate skeleton (`search-wasm`), one consumer app
(`directory`, the 506-site Tabworthy rebuild) and one Starlight docs app.

## Quickstart

```sh
bun install
make ci          # build, test, lint, coverage, registry + conformance audit
bun run scripts/new-kit.ts my-kit dx   # scaffold a new kit
```

## Apps

| App              | Stack                 | Purpose                                             |
| ---------------- | --------------------- | --------------------------------------------------- |
| `apps/directory` | Astro + Solid islands | 506-site directory; first consumer pinning the kits |
| `apps/docs`      | Starlight             | estate handbook and kit docs                        |

## The compounding rules

1. Everything an estate needs from a package (SPEC, fixtures, registry
   entry, audit) arrives by script (`new-kit.ts`), not by memory.
2. Wire semantics shared with Rust live once, in `conformance/`, and both
   languages pass them.
3. `core` status is earned by an exact consumer pin; the audit fails a lie.
4. wasm is always optional behind a TS twin with the same interface.

See `AGENTS.md` for the full contract and `estate.yml` for the registry.
