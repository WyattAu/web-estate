// @est/search/solid: SolidJS bindings. Lazy single init via createResource;
// search is synchronous over the loaded index and returns paginated
// envelopes shaped by @est/envelope.

import { createResource, type Resource } from "solid-js";
import { createSearchIndex, type SearchDoc, type SearchHit, type SearchIndex } from "./index";

export type SearchStatus =
  | { state: "loading" }
  | { state: "error"; code: "UNAVAILABLE"; message: string }
  | { state: "ready"; index: SearchIndex };

/**
 * Load a corpus once; Suspense-friendly. `load` may swap in the wasm index
 * when crates/search-wasm is built; falling back to TS is normal, not an
 * error path.
 */
export function useSearchIndex(load: () => Promise<readonly SearchDoc[]>): Resource<SearchIndex> {
  const [index] = createResource(async () => {
    const docs = await load();
    const idx = createSearchIndex();
    for (const d of docs) idx.add(d);
    idx.build();
    return idx;
  });
  return index;
}

/** Run a query against a ready index; pure and synchronous. */
export function queryIndex(index: SearchIndex, q: string, limit = 20): SearchHit[] {
  return index.search(q, limit);
}
