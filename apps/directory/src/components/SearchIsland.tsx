// The search island: the only interactive island on the site.
// Kits pinned exactly and used for real:
//   @est/search  -> corpus index + scored queries (TS impl; wasm twin optional)
//   @est/errcode -> error taxonomy for index-load failure (UNAVAILABLE)
//   @est/envelope-> result pages wrapped in the ApiResponse pagination shape

import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import { queryIndex, useSearchIndex } from "@est/search/solid";
import type { SearchDoc } from "@est/search";
import { errcode } from "@est/errcode";
import {
  decodeEnvelope,
  envelopePaginated,
  type PaginationMeta,
} from "@est/envelope";
import { sites, type SiteRecord } from "../lib/data";

const PER_PAGE = 12;

const corpusMap = new Map(sites.map((s) => [s.slug, s]));
const corpus: SearchDoc[] = sites.map((s) => ({
  id: s.slug,
  title: s.name ?? s.slug,
  tags: s.tags,
  description: s.description ?? "",
}));

function SiteCard(props: { site: SiteRecord }) {
  return (
    <a class="card" href={`/site/${props.site.slug}/`} style="text-decoration:none;color:inherit">
      <h3>{props.site.name}</h3>
      <p>{props.site.description?.slice(0, 110)}</p>
      <p>{props.site.domain}</p>
    </a>
  );
}

export default function SearchIsland() {
  const [indexRes] = useSearchIndex(async () => corpus);
  const [q, setQ] = createSignal("");
  const [page, setPage] = createSignal(1);

  const pageEnvelope = createMemo(() => {
    const index = indexRes();
    if (!index) return undefined;
    const hits = queryIndex(index, q(), 200);
    const totalPages = Math.max(1, Math.ceil(hits.length / PER_PAGE));
    const p = Math.min(page(), totalPages);
    const slice = hits
      .slice((p - 1) * PER_PAGE, p * PER_PAGE)
      .map((h) => corpusMap.get(h.id))
      .filter((s): s is SiteRecord => s !== undefined);
    // The envelope kit shapes the contract the UI renders from; decode
    // round-trips it so the island breaks loudly if the wire shape drifts.
    const env = envelopePaginated(slice, {
      page: p,
      per_page: PER_PAGE,
      total: hits.length,
      total_pages: totalPages,
    });
    const decoded = decodeEnvelope<SiteRecord[]>(JSON.parse(JSON.stringify(env)));
    return decoded.ok ? decoded.envelope : undefined;
  });

  const pagination = (): PaginationMeta | undefined => pageEnvelope()?.pagination;

  return (
    <div>
      <input
        type="search"
        placeholder={`Search ${corpus.length} sites: try "3d", "piano", "city builder"...`}
        value={q()}
        onInput={(e) => {
          setQ(e.currentTarget.value);
          setPage(1);
        }}
        style={{
          width: "100%",
          padding: "0.6rem 0.8rem",
          "font-size": "1rem",
          "border-radius": "8px",
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--fg)",
        }}
        aria-label="Search the directory"
      />

      <Switch>
        <Match when={indexRes.error}>
          <p role="alert" class="err">
            {errcode("Unavailable").code}: index failed to load; refresh to retry.
          </p>
        </Match>
        <Match when={!indexRes()}>
          <p class="muted">Loading index...</p>
        </Match>
        <Match when={pageEnvelope()} keyed>
          {(env) => (
            <>
              <p class="muted" style={{ margin: "0.6rem 0 0.4rem" }}>
                {pagination()?.total ?? 0} result(s)
                {pagination() && pagination()!.total_pages > 1
                  ? ` | page ${pagination()!.page} of ${pagination()!.total_pages}`
                  : ""}
              </p>
              <div class="grid">
                <For each={env.data ?? []}>{(s) => <SiteCard site={s} />}</For>
              </div>
              <Show when={(pagination()?.total_pages ?? 1) > 1}>
                <nav
                  style={{ display: "flex", gap: "0.5rem", "margin-top": "0.8rem" }}
                  aria-label="Search result pages"
                >
                  <button disabled={pagination()!.page <= 1} onClick={() => setPage((p) => p - 1)}>
                    &larr; prev
                  </button>
                  <button
                    disabled={pagination()!.page >= pagination()!.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    next &rarr;
                  </button>
                </nav>
              </Show>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
