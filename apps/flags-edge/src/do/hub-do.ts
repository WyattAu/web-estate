// FlagHub Durable Object: terminates WebSockets, delivers hello on
// connect, and broadcasts flag-update frames on setFlag. All message
// handling delegates to FlagHubCore (unit-tested against the contract).

import { DurableObject } from "cloudflare:workers";
import { FlagHubCore } from "../hub";

export class FlagHubDO extends DurableObject {
  #hub = new FlagHubCore({ "ledger-beta": false });
  #sockets = new Map<WebSocket, string>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws" && request.headers.get("upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const id = crypto.randomUUID();
      this.ctx.acceptWebSocket(pair[1]);
      this.#sockets.set(pair[1], id);
      for (const frame of this.#hub.subscribe(id)) pair[1].send(frame);
      return new Response(null, { status: 101, webSocket: pair[1] });
    }
    return new Response("websocket upgrade required", { status: 426 });
  }

  /** Called by the admin route when a flag flips. */
  broadcast(frame: string): void {
    for (const socket of this.#sockets.keys()) {
      try {
        socket.send(frame);
      } catch {
        // dropped socket; cleanup happens on close
      }
    }
  }

  setFlag(name: string, enabled: boolean): void {
    this.#hub.setFlag(name, enabled);
    const frame = JSON.stringify({ type: "flag-update", name, enabled });
    this.broadcast(frame);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    const id = this.#sockets.get(ws);
    if (id !== undefined) {
      this.#hub.unsubscribe(id);
      this.#sockets.delete(ws);
    }
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    if (message.includes('"type":"ping"')) {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }
}
