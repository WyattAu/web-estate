# AGENTS.md: web-estate

The single contract for this repo. Agent-facing; read this before writing code.

## What this repo is

The web frontend estate: TS + SolidJS + Astro + Starlight packages under Bun,
with optional custom wasm (no Leptos; Solid owns the DOM, Rust owns pure
logic). It mirrors the Rust kit estate: small kits, exact pins, a registry of
record, golden conformance fixtures, suites that compose kits and hold no
business logic.

## Where the truth lives

| Concern                                | Truth                            | Mirrors/projections      |
| -------------------------------------- | -------------------------------- | ------------------------ |
| Packages, versions, statuses, pins     | `estate.yml`                     | `llms.txt`, audit report |
| Wire semantics shared with Rust crates | `conformance/<suite>/cases.json` | tests in both languages  |
| Kit contracts                          | `packages/errcode/SPEC.md`, `packages/envelope/SPEC.md`, `packages/search/SPEC.md` | docs app pages |
| wasm ABI                               | `crates/search-wasm/src/lib.rs`  | optional npm wrapper     |
| Verbs                                  | `package.json` scripts           | `Makefile`, CI           |

## The verbs

`build test lint fmt fmt-check coverage contract ci` (Makefile aliases
package.json scripts). CI runs `make ci` and nothing else; there are no
CI-only steps. `contract` runs the registry audit plus the conformance
fixture check and must pass before any commit that touches estate.yml,
package versions, or fixtures.

## Status vocabulary is earned

`core` means a consumer app pins the package at an exact version; the audit
enforces the claim. Never mark core "in advance".

## Parity rule

Where a TS package mirrors a Rust crate (`mirrors:` in estate.yml), both
implementations pass the same `conformance/` fixtures. Wire shapes are
named after the Rust side (snake_case keys like `per_page` stay snake_case
on the wire; camelCase only in TS property names). A normative wire rule
without a fixture is draft material.

## wasm rule

Rust never touches the DOM. Solid owns rendering; crates export pure logic
or hot paths. Every wasm module is an optional enhancement behind a TS
implementation of the same interface, chosen by the same fixtures. The
wrapper package version must equal the crate version (audit enforces).

## Docs

SPEC-CORE per kit: status stamp, truth table reference, REQ anchors, oracle
lines. No em-dash character in any Markdown. `llms.txt` is generated
(`bun run docs:llms`); never hand-edit.

## Adding a kit

`bun run scripts/new-kit.ts <name> <area>` scaffolds the package, a draft
SPEC, and registers it in estate.yml. Then: implement, add fixtures if the
kit has wire semantics, pin it from an app when it is real.

## Layout

```
packages/   npm kits under @est (errcode, envelope, search, ...)
crates/     Rust wasm crates (pure logic only)
apps/       consumer suites (directory: Astro + Solid islands; docs: Starlight)
conformance/ golden fixtures shared with the Rust side
scripts/    estate-audit, check-conformance, new-kit, llms-txt
```
