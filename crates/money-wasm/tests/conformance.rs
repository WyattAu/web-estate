//! Native parity: run the shared money conformance fixture through
//! decimal-money (the wasm twin wraps this same implementation), proving
//! the vectors agree with the Rust implementation before TS or wasm
//! consumers rely on them.

use serde_json::Value;

const CASES: &str = include_str!("../../../conformance/money/cases.json");

#[test]
fn allocate_vectors_match_rust() {
    let fixture: Value = serde_json::from_str(CASES).expect("fixture parses");
    assert_eq!(fixture["suite"], "money");

    for case in fixture["allocate_cases"].as_array().expect("cases") {
        let name = case["name"].as_str().expect("name");
        let total = decimal_money::CurrencyAmount::from_str_values(
            case["amount"].as_str().expect("amount"),
            case["currency"]
                .as_str()
                .expect("currency")
                .parse()
                .expect("currency"),
        )
        .expect("amount parses");

        let ratios: Vec<rust_decimal::Decimal> = case["ratios"]
            .as_array()
            .expect("ratios")
            .iter()
            .map(|r| rust_decimal::Decimal::from_str_exact(r.as_str().expect("ratio")))
            .collect::<Result<_, _>>()
            .expect("ratios parse");

        let result = total.allocate(&ratios);

        if let Some(expected_error) = case.get("error").and_then(|e| e.as_str()) {
            let err = result.expect_err(name);
            assert!(
                err.to_string().to_lowercase().contains("invalid"),
                "case {name}: expected invalid-amount class, got {err}"
            );
            continue;
        }

        let parts = result.expect(name);
        let expected: Vec<String> = case["expected"]
            .as_array()
            .expect("expected")
            .iter()
            .map(|v| v.as_str().expect("string").to_string())
            .collect();
        let actual: Vec<String> = parts.iter().map(|p| p.amount.to_string()).collect();
        assert_eq!(actual, expected, "case {name} diverged");

        // Preservation invariant: parts sum to the original exactly.
        let sum: rust_decimal::Decimal = parts.iter().map(|p| p.amount).sum();
        assert_eq!(sum, total.amount, "case {name}: parts lost units");
    }
}

#[test]
fn round_vectors_match_rust() {
    let fixture: Value = serde_json::from_str(CASES).expect("fixture parses");

    for case in fixture["round_cases"].as_array().expect("round cases") {
        let total = decimal_money::CurrencyAmount::from_str_values(
            case["amount"].as_str().expect("amount"),
            case["currency"]
                .as_str()
                .expect("currency")
                .parse()
                .expect("currency"),
        )
        .expect("amount parses");
        let places = case["places"].as_u64().expect("places") as u32;
        let policy = case["policy"].as_str().expect("policy").to_string();

        let strat = match policy.as_str() {
            "HalfUp" => decimal_money::RoundingPolicy::HalfUp,
            "HalfEven" => decimal_money::RoundingPolicy::HalfEven,
            "HalfDown" => decimal_money::RoundingPolicy::HalfDown,
            "Floor" => decimal_money::RoundingPolicy::Floor,
            other => panic!("unknown policy {other}"),
        };
        let rounded = total.round_to_with_policy(places, strat);
        let expected = case["expected"].as_str().expect("expected");
        assert_eq!(
            rounded.amount.to_string(),
            expected,
            "round case {policy} {total:?} diverged"
        );
    }
}
