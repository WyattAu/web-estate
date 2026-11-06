// The flags-edge worker: /evaluate + /healthz HTTP routes (flagsd
// compatible) and the /ws endpoint routed to the FlagHub Durable Object
// for flag-update push.

import { FlagHubDO } from "./do/hub-do";

export { FlagHubDO };

interface Env {
  FLAG_HUB: DurableObjectNamespace;
}

const FLAGS: Record<string, boolean> = {
  "ledger-beta": true,
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = {
      "access-control-allow-origin": "https://web-estate-ledger.pages.dev",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "content-type": "application/json; charset=utf-8",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/ws") {
      const id = env.FLAG_HUB.idFromName("global");
      const stub = env.FLAG_HUB.get(id);
      return stub.fetch(request);
    }

    const evaluateMatch = /^\/evaluate\/([^/]+)$/.exec(url.pathname);
    if (evaluateMatch && request.method === "GET") {
      const name = decodeURIComponent(evaluateMatch[1] ?? "");
      const enabled = FLAGS[name] ?? false;
      return Response.json({ name, enabled }, { headers: cors });
    }

    if (url.pathname === "/healthz") {
      return Response.json({ status: "healthy" }, { headers: cors });
    }

    return Response.json({ error: "not found" }, { status: 404, headers: cors });
  },
};
