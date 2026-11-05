#!/usr/bin/env bash
# Build the money-wasm artifact into packages/money-wasm/pkg (target web).
# The wrapper is version-locked to the crate (estate-audit enforces).
set -euo pipefail
cd "$(dirname "$0")/../crates/money-wasm"
wasm-pack build --target web --out-dir ../../packages/money-wasm/pkg --release
echo "money-wasm: built packages/money-wasm/pkg/"
