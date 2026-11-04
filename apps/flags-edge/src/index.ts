// flags-edge: a flagsd-compatible evaluate endpoint at the edge, so the
// deployed ledger's flags client has a live service to talk to. Wire
// compatible with flagsd's GET /evaluate/{name}?user=&org= -> {name, enabled}.

// Static flag table; flip values here and redeploy.
const FLAGS: Record<string, boolean> = {
  "ledger-beta": true,
};

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const cors = {
      "access-control-allow-origin": "https://web-estate-ledger.pages.dev",
      "access-control-allow-methods": "GET, OPTIONS",
      "content-type": "application/json; charset=utf-8",
    };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === "/healthz") {
      return Response.json({ status: "healthy" }, { headers: cors });
    }

    const evaluate = /^\/evaluate\/([^/]+)$/.exec(url.pathname);
    if (evaluate && req.method === "GET") {
      const name = decodeURIComponent(evaluate[1] ?? "");
      const enabled = FLAGS[name] ?? false;
      return Response.json({ name, enabled }, { headers: cors });
    }

    return Response.json({ error: "not found" }, { status: 404, headers: cors });
  },
};
