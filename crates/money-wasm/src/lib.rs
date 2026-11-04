//! money-wasm: the wasm twin of @est/money.
//!
//! Wraps the published `decimal-money` crate (the money estate's own
//! implementation) over a JSON boundary — the wasm twin is the Rust
//! implementation compiled for the browser, not a reimplementation.
//! Causal contract and rounding policies mirror `decimal-money` exactly;
//! conformance runs the shared fixture file (conformance/money/cases.json)
//! natively in `cargo test`.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

const CASES: &str = include_str!("../../../conformance/money/cases.json");

#[derive(Serialize, Deserialize, Clone)]
pub struct WasmMoney {
    pub value: String,
    pub currency: String,
}

/// Allocate `value` across `ratios` (decimal strings). Returns the parts
/// as decimal strings, or an error string on invalid input.
pub fn allocate(value: &str, currency: &str, ratios: &[String]) -> Result<Vec<String>, String> {
    let amount = decimal_money::CurrencyAmount::from_str_values(value, parse_currency(currency)?)
        .map_err(|e| e.to_string())?;
    let mut ratios_decimal = Vec::with_capacity(ratios.len());
    for r in ratios {
        let d = rust_decimal::Decimal::from_str_exact(r)
            .map_err(|e| format!("bad ratio {r}: {e}"))?;
        ratios_decimal.push(d);
    }
    let parts = amount
        .allocate(&ratios_decimal)
        .map_err(|e| e.to_string())?;
    Ok(parts
        .iter()
        .map(|p| p.amount.to_string())
        .collect())
}

/// Round `value` to `places` with a policy name
/// ("HalfUp" | "HalfEven" | "HalfDown" | "Floor").
pub fn round(value: &str, currency: &str, places: u32, policy: &str) -> Result<String, String> {
    let amount = decimal_money::CurrencyAmount::from_str_values(value, parse_currency(currency)?)
        .map_err(|e| e.to_string())?;
    let strat = parse_policy(policy)?;
    Ok(amount.round_to_with_policy(places, strat).amount.to_string())
}

fn parse_currency(code: &str) -> Result<decimal_money::Currency, String> {
    code.parse::<decimal_money::Currency>()
        .map_err(|e| format!("bad currency {code}: {e}"))
}

fn parse_policy(policy: &str) -> Result<decimal_money::RoundingPolicy, String> {
    match policy {
        "HalfUp" => Ok(decimal_money::RoundingPolicy::HalfUp),
        "HalfEven" => Ok(decimal_money::RoundingPolicy::HalfEven),
        "HalfDown" => Ok(decimal_money::RoundingPolicy::HalfDown),
        "Floor" => Ok(decimal_money::RoundingPolicy::Floor),
        other => Err(format!("unknown rounding policy: {other}")),
    }
}

/// Fixture access for tests and tooling (the shared conformance corpus).
pub fn fixture_json() -> &'static str {
    CASES
}

// ---- wasm boundary: JSON in, JSON out (the TS side owns the schema) ----

#[wasm_bindgen]
pub fn allocate_json(
    value: &str,
    currency: &str,
    ratios_json: &str,
) -> Result<String, JsValue> {
    let ratios: Vec<String> =
        serde_json::from_str(ratios_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let parts = allocate(value, currency, &ratios)?;
    serde_json::to_string(&parts).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn round_json(value: &str, currency: &str, places: u32, policy: &str) -> Result<String, JsValue> {
    round(value, currency, places, policy).map_err(|e| JsValue::from_str(&e.to_string()))
}
