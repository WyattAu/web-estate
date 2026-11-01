# directory-api

DRAFT (tier a; application with normative API rules, last audit 2026-11-01)

The deployed HTTP API for the directory suite: a Cloudflare Worker serving
`json-envelope` responses built from the same `@est` kits the frontend
uses. Deployed at the account's workers.dev subdomain as
`web-estate-directory-api`; production origin used by the site island.

## Truth table

| Concern | Truth |
|---|---|
| Routes, params, status mapping | this SPEC + `src/routes.ts` |
| Envelope wire shape | `@est/envelope` + `conformance/envelope/cases.json` |
| Search semantics | `@est/search` + `conformance/search/cases.json` |
| Corpus | `@est/directory-data` |

## Routes

| Route | Params | Success | Failure |
|---|---|---|---|
| `GET /api/health` | - | `{success, data:{sites}}` | - |
| `GET /api/sites` | `page>=1`, `per_page` 1..100 (default 50) | paginated summaries | `BAD_REQUEST` envelope, 400 |
| `GET /api/sites/{slug}` | - | full site record | `NOT_FOUND`, 404 |
| `GET /api/search` | `q` required, `limit` 1..100 (default 20) | scored hits `{id,score,name,domain}` | `BAD_REQUEST`, 400 |
| `OPTIONS` any | - | 204 + CORS | - |

## Rules

- RULE-1: Every response body is an `ApiResponse` envelope; failures carry
  the `@est/errcode` code string and the errcode's HTTP status. Oracle:
  `bun test apps/directory-api`.
- RULE-2: CORS is an allowlist (`web-estate-directory.pages.dev`,
  `localhost:4321`); disallowed origins get no ACAO header but still get
  the body. Oracle: CORS tests.
- RULE-3: The corpus is `@est/directory-data`, never a copy. Oracle: type
  import; no dataset file exists under this app.

## Deploy

`bun run deploy` (wrangler, project `web-estate-directory-api`).
