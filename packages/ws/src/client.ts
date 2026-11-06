// @est/ws client: a reconnecting flag stream over the browser WebSocket.
// Frames parse through the contract (parseWsMessage); unknown frames are
// dropped. Reconnect uses capped exponential backoff; send() silently
// drops when the socket is down (the next reconnect re-subscribes).

import { parseWsMessage, type ServerMessage } from "./index";

export interface FlagStreamCallbacks {
  onHello?: (flags: Record<string, boolean>) => void;
  onFlagUpdate?: (name: string, enabled: boolean) => void;
  onStateChange?: (state: "connecting" | "open" | "closed") => void;
}

export interface FlagStream {
  close(): void;
}

const MAX_BACKOFF_MS = 30_000;

export function createFlagStream(url: string, callbacks: FlagStreamCallbacks = {}): FlagStream {
  let closed = false;
  let attempt = 0;
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    if (closed) return;
    callbacks.onStateChange?.("connecting");
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      attempt = 0;
      callbacks.onStateChange?.("open");
    });

    socket.addEventListener("message", (event) => {
      const parsed = parseWsMessage(typeof event.data === "string" ? event.data : "");
      if (!parsed) return;
      switch (parsed.type) {
        case "flag-update":
          callbacks.onFlagUpdate?.(parsed.name, parsed.enabled);
          break;
        case "hello":
          callbacks.onHello?.(parsed.flags);
          break;
        case "pong":
          break;
      }
    });

    socket.addEventListener("close", () => {
      if (closed) return;
      callbacks.onStateChange?.("closed");
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      // close event follows; handled there
    });
  }

  function scheduleReconnect(): void {
    const delay = Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
      callbacks.onStateChange?.("closed");
    },
  };
}

export type { ServerMessage };
