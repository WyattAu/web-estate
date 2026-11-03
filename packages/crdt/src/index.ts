// @est/crdt: TS mirror of the crdts-kit RGA text CRDT.
// Wire truth: conformance/crdt/cases.json (convergence scenarios);
// algorithms mirror crdts-kit/src/text.rs operation for operation.
// Causal delivery contract: an operation may only be applied after the
// operations that created its origins (standard RGA model; transports
// provide ordering, this kit does not deduplicate).

export interface OperationId {
  /** Replica that created the operation. */
  site_id: number;
  /** Per-site logical clock value at creation time. */
  counter: number;
}

export interface InsertOperation {
  type: "insert";
  id: OperationId;
  /** Position in the authoring replica's view (informational). */
  position: number;
  /** Single character. */
  content: string;
  origin_left: OperationId | null;
  origin_right: OperationId | null;
}

export interface DeleteOperation {
  type: "delete";
  id: OperationId;
  target: OperationId;
}

export type TextOperation = InsertOperation | DeleteOperation;

/** Total order used for concurrent-sibling tie-breaks: site, then counter. */
export function compareIds(a: OperationId, b: OperationId): number {
  if (a.site_id !== b.site_id) return a.site_id - b.site_id;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return 0;
}

function sameId(a: OperationId, b: OperationId): boolean {
  return a.site_id === b.site_id && a.counter === b.counter;
}

interface RgaNode {
  char: string;
  id: OperationId;
  tombstone: boolean;
}

/**
 * Replicated string backed by an RGA. Local edits return the operations
 * to broadcast; remote ops are ingested with apply() in any causal order.
 */
export class RgaString {
  #nodes: RgaNode[] = [];
  /** Global logical clock, shared across sites, as in the Rust crate. */
  #clock = 0;

  #nextId(siteId: number): OperationId {
    this.#clock += 1;
    return { site_id: siteId, counter: this.#clock };
  }

  #visibleIdAt(index: number): OperationId | null {
    for (const node of this.#nodes) {
      if (!node.tombstone) {
        if (index === 0) return node.id;
        index -= 1;
      }
    }
    return null;
  }

  /** Vector index at which `id` integrates: after origin_left, then skip
   * every node whose id is greater (order-independent sibling interleave). */
  #findInsertPosition(id: OperationId, originLeft: OperationId | null): number {
    let pos = 0;
    if (originLeft) {
      const i = this.#nodes.findIndex((n) => sameId(n.id, originLeft));
      pos = i === -1 ? 0 : i + 1;
    }
    while (pos < this.#nodes.length && compareIds(this.#nodes[pos]!.id, id) > 0) {
      pos += 1;
    }
    return pos;
  }

  /** Local insert at visible `index`; returns one op per character. */
  insert(siteId: number, index: number, content: string): TextOperation[] {
    if (content.length === 0) return [];
    const chars = [...content];
    const leftId = index === 0 ? null : this.#visibleIdAt(index - 1);
    const rightId = this.#visibleIdAt(index);

    const ops: TextOperation[] = [];
    let prevId = leftId;
    for (const char of chars) {
      const id = this.#nextId(siteId);
      ops.push({
        type: "insert",
        id,
        position: index,
        content: char,
        origin_left: prevId,
        origin_right: rightId,
      });
      prevId = id;
    }
    for (const op of ops) this.apply(op);
    return ops;
  }

  /** Local delete of `len` visible characters at `index`. */
  delete(siteId: number, index: number, len: number): TextOperation[] {
    const targets: OperationId[] = [];
    let remaining = len;
    let visibleIdx = 0;
    for (const node of this.#nodes) {
      if (!node.tombstone) {
        if (visibleIdx >= index && remaining > 0) {
          targets.push(node.id);
          remaining -= 1;
        }
        visibleIdx += 1;
      }
      if (remaining === 0) break;
    }
    const ops: TextOperation[] = targets.map((target) => ({
      type: "delete",
      id: this.#nextId(siteId),
      target,
    }));
    for (const op of ops) this.apply(op);
    return ops;
  }

  /** Ingest a remote operation (causal delivery required). */
  apply(op: TextOperation): void {
    if (op.id.counter > this.#clock) this.#clock = op.id.counter;
    if (op.type === "insert") {
      const char = [...op.content][0];
      if (char === undefined) return;
      const pos = this.#findInsertPosition(op.id, op.origin_left);
      this.#nodes.splice(pos, 0, { char, id: op.id, tombstone: false });
      return;
    }
    const node = this.#nodes.find((n) => sameId(n.id, op.target));
    if (node) node.tombstone = true;
  }

  /** Render the visible text, skipping tombstones. */
  text(): string {
    return this.#nodes
      .filter((n) => !n.tombstone)
      .map((n) => n.char)
      .join("");
  }

  /** Count of live (non-tombstoned) characters. */
  get length(): number {
    return this.#nodes.filter((n) => !n.tombstone).length;
  }
}

export interface ParticipantInfo {
  site_id: number;
  name: string;
}

/** Document wrapper: identity, presence, and a version counter. */
export class CrdtDocument {
  readonly id: string;
  readonly content = new RgaString();
  #participants = new Map<number, ParticipantInfo>();
  #version = 0;

  constructor(id: string) {
    this.id = id;
  }

  join(siteId: number, name: string): ParticipantInfo {
    const info: ParticipantInfo = { site_id: siteId, name };
    this.#participants.set(siteId, info);
    return info;
  }

  leave(siteId: number): void {
    this.#participants.delete(siteId);
  }

  participants(): ParticipantInfo[] {
    return [...this.#participants.values()].sort((a, b) => a.site_id - b.site_id);
  }

  /** Local edit: applies and returns (ops, new version). */
  insertText(
    siteId: number,
    index: number,
    content: string,
  ): { ops: TextOperation[]; version: number } {
    const ops = this.content.insert(siteId, index, content);
    this.#version += 1;
    return { ops, version: this.#version };
  }

  deleteText(
    siteId: number,
    index: number,
    len: number,
  ): { ops: TextOperation[]; version: number } {
    const ops = this.content.delete(siteId, index, len);
    this.#version += 1;
    return { ops, version: this.#version };
  }

  /** Ingest remote operations; returns the new version. */
  applyOps(ops: TextOperation[]): number {
    for (const op of ops) this.content.apply(op);
    this.#version += 1;
    return this.#version;
  }

  get text(): string {
    return this.content.text();
  }

  get version(): number {
    return this.#version;
  }
}
