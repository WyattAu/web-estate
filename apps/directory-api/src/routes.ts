// Pure route handlers for the directory API. No runtime imports: takes a
// URL, returns an envelope-shaped Response. Testable in bun without a
// Workers runtime; src/worker.ts is the thin Cloudflare shell.

import {
  envelopeError,
  envelopePaginated,
  type ApiResponse,
} from "@est/envelope";
import { errcode, type ErrorCodeName } from "@est/errcode";
import { indexDocs, type SearchDoc } from "@est/search";
import { sites, type SiteRecord } from "@est/directory-data";

export interface RouteResult {
  response: ApiResponse<unknown>;
  status: number;
}

const ALLOWED_ORIGINS = new Set([
  "https://web-estate-directory.pages.dev",
  "http://localhost:4321",
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
    base["Vary"] = "Origin";
  }
  return base;
}

function envelopeResponse(
  result: RouteResult,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(result.response), {
    status: result.status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function ok<T>(envelope: ApiResponse<T>): RouteResult {
  return { response: envelope as ApiResponse<unknown>, status: 200 };
}

function fail(name: ErrorCodeName, message: string, details?: unknown): RouteResult {
  return {
    response: envelopeError(name, message, details),
    status: errcode(name).status,
  };
}

/** The search corpus, derived once from the shared dataset. */
const corpus: SearchDoc[] = sites.map((s) => ({
  id: s.slug,
  title: s.name ?? s.slug,
  tags: s.tags,
  description: s.description ?? "",
}));
let searchIndex: ReturnType<typeof indexDocs> | null = null;
function getIndex() {
  searchIndex ??= indexDocs(corpus);
  return searchIndex;
}

const bySlug = new Map(sites.map((s) => [s.slug, s]));

function summary(s: SiteRecord) {
  return { slug: s.slug, name: s.name, domain: s.domain, category: s.category?.replace(/\/$/, "") };
}

export function handleApiRequest(url: URL): RouteResult {
  const path = url.pathname.replace(/\/+$/, "");

  if (path === "/api/sites") {
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const perPageRaw = Number(url.searchParams.get("per_page") ?? "50");
    if (!Number.isInteger(pageRaw) || pageRaw < 1) return fail("BadRequest", "page must be a positive integer");
    if (!Number.isInteger(perPageRaw) || perPageRaw < 1 || perPageRaw > 100) {
      return fail("BadRequest", "per_page must be an integer in 1..100");
    }
    const sorted = [...sites].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const totalPages = Math.max(1, Math.ceil(sorted.length / perPageRaw));
    const page = Math.min(pageRaw, totalPages);
    const slice = sorted.slice((page - 1) * perPageRaw, page * perPageRaw).map(summary);
    return ok(envelopePaginated(slice, { page, per_page: perPageRaw, total: sorted.length, total_pages: totalPages }));
  }

  const siteMatch = /^\/api\/sites\/([^/]+)$/.exec(path);
  if (siteMatch) {
    const slug = decodeURIComponent(siteMatch[1] ?? "");
    const site = bySlug.get(slug);
    if (!site) return fail("NotFound", `no such site: ${slug}`);
    return ok({
      success: true,
      data: {
        ...summary(site),
        description: site.description,
        url: site.url,
        tags: site.tags,
        price: site.price,
        featured_in: site.featured_in,
        related: site.related,
      },
    });
  }

  if (path === "/api/search") {
    const q = url.searchParams.get("q");
    if (q === null || q.trim() === "") return fail("BadRequest", "q is required");
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
      return fail("BadRequest", "limit must be an integer in 1..100");
    }
    const hits = getIndex().search(q, limitRaw);
    const data = hits.map((h) => {
      const s = bySlug.get(h.id);
      return { id: h.id, score: h.score, name: s?.name ?? h.id, domain: s?.domain };
    });
    return ok({ success: true, data });
  }

  if (path === "/api/health") {
    return ok({ success: true, data: { sites: sites.length } });
  }

  return fail("NotFound", `no route: ${path}`);
}

/**
 * Entry for tests and the worker shell: route + CORS in one call.
 * Envelope in, envelope out; every failure is an envelope error with the
 * errcode's HTTP status.
 */
export async function respond(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "GET") {
    return envelopeResponse(fail("BadRequest", "method not allowed; GET only"), origin);
  }
  const result = handleApiRequest(url);
  return envelopeResponse(result, origin);
}
