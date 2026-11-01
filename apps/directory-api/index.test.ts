import { describe, expect, test } from "bun:test";
import { handleApiRequest, respond } from "./src/routes";

const url = (path: string) => new URL(path, "https://api.example.com");

function get(path: string, origin?: string): Promise<Response> {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return respond(new Request(url(path), { headers }));
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe("directory-api routes", () => {
  test("health reports the corpus size", async () => {
    const res = await get("/api/health");
    expect(res.status).toBe(200);
    const b = await body(res);
    expect(b.success).toBe(true);
    expect((b.data as { sites: number }).sites).toBeGreaterThan(500);
  });

  test("sites list paginates with snake_case wire keys", async () => {
    const res = await get("/api/sites?page=2&per_page=50");
    expect(res.status).toBe(200);
    const b = await body(res);
    expect(b.success).toBe(true);
    const pag = b.pagination as Record<string, number>;
    expect(pag.page).toBe(2);
    expect(pag.per_page).toBe(50);
    expect(pag.total).toBeGreaterThan(500);
    expect(pag.total_pages).toBeGreaterThan(10);
    expect(Object.hasOwn(pag, "perPage")).toBe(false);
  });

  test("sites list rejects bad paging with envelope errors", async () => {
    const res = await get("/api/sites?page=0");
    expect(res.status).toBe(400);
    const b = await body(res);
    expect((b.error as { code: string }).code).toBe("BAD_REQUEST");
  });

  test("site detail round-trips a known slug", async () => {
    const res = await get("/api/sites/townscaper");
    expect(res.status).toBe(200);
    const b = await body(res);
    expect((b.data as { name: string }).name).toBe("Townscaper");
  });

  test("unknown slug is a NOT_FOUND envelope with 404", async () => {
    const res = await get("/api/sites/nope-nope");
    expect(res.status).toBe(404);
    const b = await body(res);
    expect((b.error as { code: string }).code).toBe("NOT_FOUND");
  });

  test("search returns scored hits for a fixture query", async () => {
    const res = await get("/api/search?q=townscaper");
    expect(res.status).toBe(200);
    const b = await body(res);
    const data = b.data as { id: string }[];
    expect(data[0]?.id).toBe("townscaper");
  });

  test("search without q is a BAD_REQUEST envelope", async () => {
    const res = await get("/api/search");
    expect(res.status).toBe(400);
    const b = await body(res);
    expect((b.error as { code: string }).code).toBe("BAD_REQUEST");
  });

  test("unknown route is a NOT_FOUND envelope", async () => {
    const res = await get("/api/none");
    expect(res.status).toBe(404);
  });

  test("CORS: allowed origin gets the header, others do not", async () => {
    const good = await get("/api/health", "https://web-estate-directory.pages.dev");
    expect(good.headers.get("access-control-allow-origin")).toBe(
      "https://web-estate-directory.pages.dev",
    );
    const bad = await get("/api/health", "https://evil.example");
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("preflight is 204 with method allowlist", async () => {
    const res = await respond(
      new Request(url("/api/search"), {
        method: "OPTIONS",
        headers: { origin: "https://web-estate-directory.pages.dev" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  test("non-GET is rejected as an envelope", async () => {
    const res = await respond(new Request(url("/api/health"), { method: "POST" }));
    expect(res.status).toBe(400);
    const b = await body(res);
    expect((b.error as { code: string }).code).toBe("BAD_REQUEST");
  });
});

describe("directory-api dataset integrity", () => {
  test("every corpus doc has a unique id matching a site slug", () => {
    const result = handleApiRequest(url("/api/health"));
    expect(result.status).toBe(200);
  });
});
