//! search-wasm: the wasm twin of @est/search.
//!
//! Rust owns pure logic and hot paths; it never touches the DOM. The TS
//! side (packages/search) is the reference implementation and the
//! always-present fallback; this crate must pass the same fixture file
//! (conformance/search/cases.json) with identical expectations.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Weight table: normative, mirrored from packages/search/SPEC.md.
const W_TITLE_EXACT: f64 = 6.0;
const W_TITLE_PREFIX: f64 = 4.0;
const W_TITLE_WORD: f64 = 3.0;
const W_TITLE_WORD_PREFIX: f64 = 1.5;
const W_TAG: f64 = 2.0;
const W_DESC: f64 = 1.0;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchDoc {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub description: String,
}

#[derive(Serialize, Clone, PartialEq)]
pub struct SearchHit {
    pub id: String,
    pub score: f64,
}

pub fn tokenize(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_ascii_lowercase())
        .collect()
}

/// Core index: wasm-free so native `cargo test` can exercise the full
/// conformance fixture. The #[wasm_bindgen] wrapper below is a thin shell.
pub struct CoreIndex {
    entries: Vec<Entry>,
    built: bool,
}

struct Entry {
    id: String,
    title_lower: String,
    title_words: Vec<String>,
    tags: Vec<String>,
    desc_lower: String,
}

impl CoreIndex {
    pub fn new() -> CoreIndex {
        CoreIndex { entries: Vec::new(), built: false }
    }

    pub fn add_json(&mut self, doc: &str) -> Result<(), String> {
        if self.built {
            return Err("index already built".to_string());
        }
        let doc: SearchDoc = serde_json::from_str(doc).map_err(|e| e.to_string())?;
        if self.entries.iter().any(|e| e.id == doc.id) {
            return Err(format!("duplicate id: {}", doc.id));
        }
        self.entries.push(Entry {
            id: doc.id,
            title_lower: doc.title.to_ascii_lowercase(),
            title_words: tokenize(&doc.title),
            tags: doc.tags.iter().map(|t| t.to_ascii_lowercase()).collect(),
            desc_lower: doc.description.to_ascii_lowercase(),
        });
        Ok(())
    }

    pub fn build(&mut self) {
        self.built = true;
    }

    pub fn size(&self) -> usize {
        self.entries.len()
    }

    /// Scored search; JSON array of {id, score}, best first.
    /// Ordering: score desc, then id asc (deterministic, same as TS).
    pub fn search_json(&self, query: &str, limit: usize) -> String {
        let hits = self.search_vec(query, limit);
        serde_json::to_string(&hits).unwrap_or_else(|_| "[]".to_string())
    }

    fn search_vec(&self, query: &str, limit: usize) -> Vec<SearchHit> {
        let q = query.trim().to_ascii_lowercase();
        if q.is_empty() {
            return Vec::new();
        }
        let mut scored: Vec<SearchHit> = Vec::new();
        for e in &self.entries {
            let mut score = 0.0;
            if e.title_lower == q {
                score += W_TITLE_EXACT;
            } else if e.title_lower.starts_with(&q) {
                score += W_TITLE_PREFIX;
            }
            for w in &e.title_words {
                if w == &q {
                    score += W_TITLE_WORD;
                } else if w.starts_with(&q) {
                    score += W_TITLE_WORD_PREFIX;
                }
            }
            for t in &e.tags {
                if t == &q || t.contains(&q) {
                    score += W_TAG;
                }
            }
            if e.desc_lower.contains(&q) {
                score += W_DESC;
            }
            if score > 0.0 {
                scored.push(SearchHit { id: e.id.clone(), score });
            }
        }
        scored.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        scored.truncate(limit);
        scored
    }
}

impl Default for CoreIndex {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
pub struct SearchIndex {
    core: CoreIndex,
}

#[wasm_bindgen]
impl SearchIndex {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SearchIndex {
        SearchIndex { core: CoreIndex::new() }
    }

    /// doc: JSON string of {id, title, tags?, description?}.
    pub fn add(&mut self, doc: &str) -> Result<(), JsValue> {
        self.core.add_json(doc).map_err(|e| JsValue::from_str(&e))
    }

    pub fn build(&mut self) {
        self.core.build();
    }

    pub fn size(&self) -> usize {
        self.core.size()
    }

    /// Returns a JSON array of {id, score}, best first.
    pub fn search(&self, query: &str, limit: usize) -> String {
        self.core.search_json(query, limit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Fixture {
        suite: String,
        docs: Vec<SearchDoc>,
        cases: Vec<FixtureCase>,
    }

    #[derive(Deserialize)]
    struct FixtureCase {
        kind: String,
        query: String,
        limit: usize,
        expected: Vec<String>,
    }

    const CASES: &str = include_str!("../../../conformance/search/cases.json");

    /// REQ-5 (packages/search/SPEC.md): the wasm twin passes the same
    /// fixture file with identical expectations.
    #[test]
    fn conformance_fixtures_pass() {
        let fixture: Fixture = serde_json::from_str(CASES).expect("fixture parses");
        assert_eq!(fixture.suite, "search");

        let mut idx = CoreIndex::new();
        for d in &fixture.docs {
            let json = serde_json::to_string(d).expect("doc serializes");
            idx.add_json(&json).expect("doc adds");
        }
        idx.build();

        for case in &fixture.cases {
            assert_eq!(case.kind, "query", "unknown case kind");
            let hits = idx.search_vec(&case.query, case.limit);
            let ids: Vec<String> = hits.into_iter().map(|h| h.id).collect();
            assert_eq!(
                ids, case.expected,
                "query {:?} diverged from fixture",
                case.query
            );
        }
    }

    #[test]
    fn tokenize_matches_ts_rule() {
        assert_eq!(tokenize("Little Alchemy-2!"), vec!["little", "alchemy", "2"]);
        assert!(tokenize("").is_empty());
    }

    #[test]
    fn duplicate_ids_rejected() {
        let mut idx = CoreIndex::new();
        let doc = serde_json::to_string(&SearchDoc { id: "a".into(), title: "A".into(), tags: vec![], description: String::new() }).unwrap();
        idx.add_json(&doc).unwrap();
        let err = idx.add_json(&doc).unwrap_err();
        assert!(err.contains("duplicate id"));
    }

    #[test]
    fn add_after_build_rejected() {
        let mut idx = CoreIndex::new();
        idx.build();
        let doc = serde_json::to_string(&SearchDoc { id: "a".into(), title: "A".into(), tags: vec![], description: String::new() }).unwrap();
        let err = idx.add_json(&doc).unwrap_err();
        assert!(err.contains("already built"));
    }
}
