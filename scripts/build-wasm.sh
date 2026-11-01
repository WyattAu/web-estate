#!/usr/bin/env bash
# Build the search-wasm artifact into packages/search-wasm/pkg (target web).
# Optional: @est/search works without it via the TS twin. The wrapper is
# version-locked to the crate (estate-audit enforces when registered).
# Canonical build path for local dev and CI alike.
set -euo pipefail
cd "$(dirname "$0")/../crates/search-wasm"
wasm-pack build --target web --out-dir ../../packages/search-wasm/pkg --release
echo "search-wasm: built packages/search-wasm/pkg/"
