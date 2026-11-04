//! crdt-wasm: the wasm twin of @est/crdt — an RGA text CRDT mirroring
//! crdts-kit's integration semantics (origin_left + id-skip, tombstone
//! deletes, single global clock). Native `cargo test` runs the shared
//! convergence fixture; the wasm boundary is a thin JSON shell.
//!
//! Causal delivery contract: ops must arrive after their origins; this
//! kit does not deduplicate (transports must not double-deliver).

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn compare_ids(a: (u32, u64), b: (u32, u64)) -> std::cmp::Ordering {
    a.cmp(&b)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TextOperation {
    Insert {
        id: OpId,
        position: usize,
        content: String,
        origin_left: Option<OpId>,
        origin_right: Option<OpId>,
    },
    Delete { id: OpId, target: OpId },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct OpId {
    pub site_id: u32,
    pub counter: u64,
}

#[derive(Clone)]
struct Node {
    char: char,
    id: OpId,
    tombstone: bool,
}

/// The RGA core: wasm-free, exercised natively by cargo test.
pub struct CoreRga {
    nodes: Vec<Node>,
    clock: u64,
}

impl CoreRga {
    pub fn new() -> Self {
        Self { nodes: Vec::new(), clock: 0 }
    }

    fn next_id(&mut self, site_id: u32) -> OpId {
        self.clock += 1;
        OpId { site_id, counter: self.clock }
    }

    fn visible_id_at(&self, mut index: usize) -> Option<OpId> {
        for node in &self.nodes {
            if !node.tombstone {
                if index == 0 {
                    return Some(node.id.clone());
                }
                index -= 1;
            }
        }
        None
    }

    fn find_insert_position(&self, id: &OpId, origin_left: &Option<OpId>) -> usize {
        let mut pos = 0;
        if let Some(left) = origin_left {
            pos = match self.nodes.iter().position(|n| n.id == *left) {
                Some(i) => i + 1,
                None => 0,
            };
        }
        while pos < self.nodes.len() {
            let node_id = (self.nodes[pos].id.site_id, self.nodes[pos].id.counter);
            if compare_ids(node_id, (id.site_id, id.counter)) != std::cmp::Ordering::Greater {
                break;
            }
            pos += 1;
        }
        pos
    }

    pub fn insert(&mut self, site_id: u32, index: usize, content: &str) -> Vec<TextOperation> {
        let chars: Vec<char> = content.chars().collect();
        if chars.is_empty() {
            return Vec::new();
        }
        let left = if index == 0 { None } else { self.visible_id_at(index - 1) };
        let right = self.visible_id_at(index);

        let mut ops = Vec::new();
        let mut prev: Option<OpId> = left;
        for c in chars {
            let id = self.next_id(site_id);
            ops.push(TextOperation::Insert {
                id: id.clone(),
                position: index,
                content: c.to_string(),
                origin_left: prev.clone(),
                origin_right: right.clone(),
            });
            prev = Some(id);
        }
        for op in &ops {
            self.apply(op.clone());
        }
        ops
    }

    pub fn delete(&mut self, site_id: u32, index: usize, len: usize) -> Vec<TextOperation> {
        let mut targets = Vec::new();
        let mut remaining = len;
        let mut visible = 0usize;
        for node in &self.nodes {
            if !node.tombstone {
                if visible >= index && remaining > 0 {
                    targets.push(node.id.clone());
                    remaining -= 1;
                }
                visible += 1;
            }
            if remaining == 0 {
                break;
            }
        }
        let mut ops = Vec::new();
        for target in targets {
            ops.push(TextOperation::Delete { id: self.next_id(site_id), target });
        }
        for op in &ops {
            self.apply(op.clone());
        }
        ops
    }

    pub fn apply(&mut self, op: TextOperation) {
        let counter = match &op {
            TextOperation::Insert { id, .. } => id.counter,
            TextOperation::Delete { id, .. } => id.counter,
        };
        if counter > self.clock {
            self.clock = counter;
        }
        match op {
            TextOperation::Insert { id, content, origin_left, .. } => {
                let Some(c) = content.chars().next() else {
                    return;
                };
                let pos = self.find_insert_position(&id, &origin_left);
                self.nodes.insert(pos, Node { char: c, id, tombstone: false });
            }
            TextOperation::Delete { target, .. } => {
                for node in &mut self.nodes {
                    if node.id == target {
                        node.tombstone = true;
                        break;
                    }
                }
            }
        }
    }

    /// Render the visible text, skipping tombstones.
    pub fn text(&self) -> String {
        self.nodes.iter().filter(|n| !n.tombstone).map(|n| n.char).collect()
    }

    /// Apply a batch of ops.
    pub fn apply_batch(&mut self, ops: Vec<TextOperation>) {
        for op in ops {
            self.apply(op);
        }
    }
}

impl Default for CoreRga {
    fn default() -> Self {
        Self::new()
    }
}

// ---- wasm boundary: thin JSON shell over CoreRga ----

#[wasm_bindgen]
pub struct WasmRga {
    core: CoreRga,
}

#[wasm_bindgen]
impl WasmRga {
    #[wasm_bindgen(constructor)]
    pub fn new() -> WasmRga {
        WasmRga { core: CoreRga::new() }
    }

    /// ops: JSON array of {type: "insert"|"delete", ...} documents.
    pub fn apply_ops(&mut self, ops: &str) -> Result<(), JsValue> {
        let parsed: Vec<TextOperation> =
            serde_json::from_str(ops).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.core.apply_batch(parsed);
        Ok(())
    }

    /// Render the visible text.
    pub fn text(&self) -> String {
        self.core.text()
    }
}

impl Default for WasmRga {
    fn default() -> Self {
        Self::new()
    }
}
