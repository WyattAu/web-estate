// Ambient types for the generated wasm-bindgen glue. The artifact under
// pkg/ is produced by scripts/build-wasm.sh and is not committed; this
// declaration lets the package typecheck without it.
declare module "../pkg/search_wasm.js" {
  export default function init(input?: ArrayBuffer | Promise<Response>): Promise<void>;
  export class SearchIndex {
    constructor();
    add(doc: string): void;
    build(): void;
    size(): number;
    search(query: string, limit: number): string;
  }
}
