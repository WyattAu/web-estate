#!/usr/bin/env bash
# Build the search-wasm artifact into crates/search-wasm/pkg (target web).
# Optional: @est/search works without it via the TS twin. The wrapper is
# version-locked to the crate (estate-audit enforces when registered).
set -euo pipefail
cd "$(dirname "$0")/../crates/search-wasm"
wasm-pack build --target web --out-dir pkg --release
echo "search-wasm: built pkg/"
