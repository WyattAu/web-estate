// Cloudflare Worker shell: all logic lives in routes.ts (pure, tested);
// this file only adapts the Workers fetch signature.

import { respond } from "./routes";

export default {
  async fetch(req: Request): Promise<Response> {
    return respond(req);
  },
};
