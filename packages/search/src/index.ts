// @est/search: client-side text search over small-to-medium corpora
// (hundreds to low thousands of documents). TS implementation is the
// reference; crates/search-wasm is an optional enhancement implementing
// the same interface and passing the same fixtures.

export interface SearchDoc {
  /** Unique document id (used as the fixture/hit identity). */
  id: string;
  /** Primary text; highest weight. */
  title: string;
  /** Secondary text; medium weight. */
  tags?: readonly string[];
  /** Long text; lowest weight. */
  description?: string;
}

export interface SearchHit {
  id: string;
  score: number;
}

/**
 * The index ABI. The wasm crate mirrors these method names; the TS
 * implementation is the reference and the always-present fallback.
 */
export interface SearchIndex {
  add(doc: SearchDoc): void;
  /** Freeze build-time structures after bulk add. */
  build(): void;
  /** Prefix-aware scored search; returns up to `limit` hits, best first. */
  search(query: string, limit?: number): SearchHit[];
  readonly size: number;
}

/** Tokenize on non-alphanumeric; lowercase; drop empties. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
}

const W_TITLE_EXACT = 6;
const W_TITLE_PREFIX = 4;
const W_TITLE_WORD = 3;
const W_TAG = 2;
const W_DESC = 1;

interface Entry {
  id: string;
  title: string;
  titleLower: string;
  titleWords: string[];
  tags: string[];
  descLower: string;
}

export class TsSearchIndex implements SearchIndex {
  #entries: Entry[] = [];
  #byId = new Map<string, Entry>();
  #built = false;

  get size(): number {
    return this.#entries.length;
  }

  add(doc: SearchDoc): void {
    if (this.#built) throw new Error("index already built");
    if (this.#byId.has(doc.id)) throw new Error(`duplicate id: ${doc.id}`);
    const titleLower = doc.title.toLowerCase();
    const entry: Entry = {
      id: doc.id,
      title: doc.title,
      titleLower,
      titleWords: tokenize(doc.title),
      tags: (doc.tags ?? []).map((t) => t.toLowerCase()),
      descLower: (doc.description ?? "").toLowerCase(),
    };
    this.#entries.push(entry);
    this.#byId.set(doc.id, entry);
  }

  build(): void {
    this.#built = true;
  }

  search(query: string, limit = 20): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return [];
    const scored: SearchHit[] = [];
    for (const e of this.#entries) {
      let score = 0;
      if (e.titleLower === q) {
        score += W_TITLE_EXACT;
      } else if (e.titleLower.startsWith(q)) {
        score += W_TITLE_PREFIX;
      }
      for (const w of e.titleWords) {
        if (w === q) score += W_TITLE_WORD;
        else if (w.startsWith(q)) score += W_TITLE_WORD / 2;
      }
      for (const t of e.tags) {
        if (t === q || t.includes(q)) score += W_TAG;
      }
      if (e.descLower.includes(q)) score += W_DESC;
      if (score > 0) scored.push({ id: e.id, score });
    }
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return scored.slice(0, limit);
  }
}

/** Create the reference index. The wasm twin plugs in behind this call. */
export function createSearchIndex(): SearchIndex {
  return new TsSearchIndex();
}

/** Convenience: build an index from documents in one call. */
export function indexDocs(docs: readonly SearchDoc[]): SearchIndex {
  const idx = createSearchIndex();
  for (const d of docs) idx.add(d);
  idx.build();
  return idx;
}
