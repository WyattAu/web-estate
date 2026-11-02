// The search island: live-first through the deployed directory API
// (fetchkit round trip: retry, envelope decode, pagination from the wire),
// falling back to the local @est/search index when the API is unreachable.
// Kits pinned exactly and used for real:
//   @est/fetchkit  -> live round trip
//   @est/search    -> local fallback index
//   @est/errcode   -> error taxonomy
//   @est/envelope  -> result pages shaped by PaginationMeta

import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";
import { createFetchKit } from "@est/fetchkit";
import { queryIndex, useSearchIndex } from "@est/search/solid";
import type { SearchDoc } from "@est/search";
import { errcode } from "@est/errcode";
import {
  decodeEnvelope,
  envelopePaginated,
  type ApiResponse,
  type PaginationMeta,
} from "@est/envelope";
import { DIRECTORY_API_BASE } from "../lib/api";
import { sites, type SiteRecord } from "../lib/data";

const PER_PAGE = 12;

const corpusMap = new Map(sites.map((s) => [s.slug, s]));
const corpus: SearchDoc[] = sites.map((s) => ({
  id: s.slug,
  title: s.name ?? s.slug,
  tags: s.tags,
  description: s.description ?? "",
}));

const kit = createFetchKit({
  retry: { maxRetries: 1, initialDelayMs: 120, maxDelayMs: 400, jitter: false },
});

type SearchResult = { env: ApiResponse<SiteRecord[]>; live: boolean } | undefined;

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
  const indexRes = useSearchIndex(async () => corpus);
  const [q, setQ] = createSignal("");
  const [page, setPage] = createSignal(1);

  const [results] = createResource(
    () => ({ q: q(), page: page(), ready: Boolean(indexRes()) }),
    async (src): Promise<SearchResult> => {
      // Live first: a real fetchkit round trip against the deployed API.
      if (src.q.trim() !== "") {
        try {
          const out = await kit.fetchEnvelopeWithMeta<SiteRecord[]>(
            `${DIRECTORY_API_BASE}/api/search?q=${encodeURIComponent(src.q)}&limit=200`,
          );
          if (out.envelope.success && Array.isArray(out.envelope.data)) {
            const hits = out.envelope.data;
            const totalPages = Math.max(1, Math.ceil(hits.length / PER_PAGE));
            const p = Math.min(src.page, totalPages);
            const slice = hits.slice((p - 1) * PER_PAGE, p * PER_PAGE);
            const env = envelopePaginated(slice, {
              page: p,
              per_page: PER_PAGE,
              total: hits.length,
              total_pages: totalPages,
            });
            // Decode round-trip keeps the island honest about the wire shape.
            const decoded = decodeEnvelope<SiteRecord[]>(
              JSON.parse(JSON.stringify(env)),
            );
            if (decoded.ok) return { env: decoded.envelope, live: true };
          }
        } catch {
          // API unreachable: local fallback below.
        }
      }
      // Local fallback (also serves the empty query).
      const index = indexRes();
      if (!index) return undefined;
      const hits = queryIndex(index, src.q, 200);
      const totalPages = Math.max(1, Math.ceil(hits.length / PER_PAGE));
      const p = Math.min(src.page, totalPages);
      const slice = hits
        .slice((p - 1) * PER_PAGE, p * PER_PAGE)
        .map((h) => corpusMap.get(h.id))
        .filter((s): s is SiteRecord => s !== undefined);
      const env = envelopePaginated(slice, {
        page: p,
        per_page: PER_PAGE,
        total: hits.length,
        total_pages: totalPages,
      });
      const decoded = decodeEnvelope<SiteRecord[]>(JSON.parse(JSON.stringify(env)));
      return decoded.ok ? { env: decoded.envelope, live: false } : undefined;
    },
  );

  const pag = (): PaginationMeta | undefined => results()?.env.pagination;

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
        <Match when={results.loading}>
          <p class="muted">Searching...</p>
        </Match>
        <Match when={results()} keyed>
          {(r) => (
            <>
              <p class="muted" style={{ margin: "0.6rem 0 0.4rem" }}>
                {pag()?.total ?? 0} result(s)
                {(pag()?.total_pages ?? 1) > 1
                  ? ` | page ${pag()?.page} of ${pag()?.total_pages}`
                  : ""}
                {" | "}
                <span class="chip">{r.live ? "live api" : "local index"}</span>
              </p>
              <div class="grid">
                <For each={r.env.data ?? []}>{(s) => <SiteCard site={s} />}</For>
              </div>
              <Show when={(pag()?.total_pages ?? 1) > 1}>
                <nav
                  style={{ display: "flex", gap: "0.5rem", "margin-top": "0.8rem" }}
                  aria-label="Search result pages"
                >
                  <button
                    type="button"
                    disabled={(pag()?.page ?? 1) <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    &larr; prev
                  </button>
                  <button
                    type="button"
                    disabled={(pag()?.page ?? 1) >= (pag()?.total_pages ?? 1)}
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
