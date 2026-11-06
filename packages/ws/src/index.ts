// @est/ws: the estate's first WebSocket message contract, authored
// fixture-first (conformance/ws/cases.json). Both sides — the flags-edge
// Durable Object and this client kit — parse and serialize the same
// message union; anything that fails parseWsMessage is not on the wire.

export type ClientMessageType = "subscribe" | "unsubscribe" | "ping";

export interface SubscribeMessage {
  type: "subscribe";
  flags: string[];
}
export interface UnsubscribeMessage {
  type: "unsubscribe";
  flags: string[];
}
export interface PingMessage {
  type: "ping";
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

export type ServerMessageType = "flag-update" | "pong" | "hello";

export interface FlagUpdateMessage {
  type: "flag-update";
  name: string;
  enabled: boolean;
}
export interface PongMessage {
  type: "pong";
}
export interface HelloMessage {
  type: "hello";
  flags: Record<string, boolean>;
}

export type ServerMessage = FlagUpdateMessage | PongMessage | HelloMessage;

export type WsMessage = ClientMessage | ServerMessage;

/** Strict parse of one wire frame. Returns null on anything not in the
 * contract (unknown kinds, missing required fields, non-JSON). */
export function parseWsMessage(wire: string): WsMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(wire);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const obj = v as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== "string") return null;

  switch (type) {
    case "subscribe":
    case "unsubscribe": {
      const flags = obj.flags;
      if (!Array.isArray(flags) || flags.some((f) => typeof f !== "string")) {
        return null;
      }
      return { type, flags } as ClientMessage;
    }
    case "ping":
      return { type: "ping" };
    case "pong":
      return { type: "pong" };
    case "flag-update": {
      if (typeof obj.name !== "string" || typeof obj.enabled !== "boolean") {
        return null;
      }
      return { type: "flag-update", name: obj.name, enabled: obj.enabled };
    }
    case "hello": {
      const flags = obj.flags;
      if (typeof flags !== "object" || flags === null) return null;
      const out: Record<string, boolean> = {};
      for (const [k, val] of Object.entries(flags)) {
        if (typeof val !== "boolean") return null;
        out[k] = val;
      }
      return { type: "hello", flags: out };
    }
    default:
      return null;
  }
}

/** Serialize one message to the wire (compact JSON). */
export function serializeWsMessage(message: WsMessage): string {
  return JSON.stringify(message);
}

export type { ServerMessage } from "./client";
