// smoke: serve a built app's dist/ and assert the pages that must exist do.
// Usage: bun run scripts/smoke.ts <app-dist-dir> [extra-paths.json...]
// Exits non-zero on first failure. Part of the `contract` verb.

import { extname, join } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
};

const dist = process.argv[2];
if (!dist) {
  console.error("usage: bun run scripts/smoke.ts <dist-dir> [paths...]");
  process.exit(2);
}

const paths = process.argv.slice(3).length > 0 ? process.argv.slice(3) : ["/"];

const server = Bun.serve({
  port: 0,
  fetch: async (req) => {
    const url = new URL(req.url);
    let file = join(dist, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith("/")) file = join(file, "index.html");
    const f = Bun.file(file);
    if (!(await f.exists())) return new Response("not found", { status: 404 });
    return new Response(f, {
      headers: { "content-type": MIME[extname(file)] ?? "application/octet-stream" },
    });
  },
});

let failures = 0;
for (const p of paths) {
  const res = await fetch(new URL(p, server.url));
  const ok = res.status === 200 && (await res.text()).length > 0;
  if (!ok) {
    failures++;
    console.error(`  FAIL ${p} -> ${res.status}`);
  } else {
    console.log(`  ok   ${p}`);
  }
}
server.stop(true);

if (failures > 0) {
  console.error(`smoke: ${failures} path(s) failed`);
  process.exit(1);
}
console.log(`smoke: green (${paths.length} paths)`);
