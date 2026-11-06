import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cases = JSON.parse(
  readFileSync(new URL("../../conformance/ws/cases.json", import.meta.url), "utf8"),
) as { suite: string; server_to_client: Record<string, unknown>[] };

import { parseWsMessage } from "@est/ws";
import { FlagHubCore } from "./src/hub";

type Suite = {
  suite: string;
  server_to_client: Record<string, unknown>[];
};

const suite = JSON.parse(JSON.stringify(cases)) as Suite;

describe("flags-edge hub", () => {
  test("hello snapshot delivered on subscribe", () => {
    const hub = new FlagHubCore({ "ledger-beta": true });
    const frames = hub.subscribe("sub-1");
    expect(frames).toHaveLength(1);
    const frame = frames[0];
    expect(frame).toBeDefined();
    const parsed = JSON.parse(frame as string) as { type: string; flags: Record<string, boolean> };
    expect(parsed.type).toBe("hello");
    expect(parsed.flags["ledger-beta"]).toBe(true);
  });

  test("flag flip enqueues flag-update frames to every subscriber", () => {
    const hub = new FlagHubCore({ "ledger-beta": false });
    hub.subscribe("a");
    hub.subscribe("b");
    hub.setFlag("ledger-beta", true);
    for (const id of ["a", "b"]) {
      const frames = hub.drain(id).map((f) => JSON.parse(f) as { type: string; enabled: boolean });
      expect(frames).toEqual([{ type: "flag-update", name: "ledger-beta", enabled: true }]);
    }
    expect(hub.subscriberCount).toBe(2);
  });

  test("drain clears the queue", () => {
    const hub = new FlagHubCore();
    hub.subscribe("s");
    hub.setFlag("x", true);
    expect(hub.drain("s")).toHaveLength(1);
    expect(hub.drain("s")).toHaveLength(0);
  });

  test("unsubscribed ids get empty drains", () => {
    const hub = new FlagHubCore();
    hub.setFlag("x", true);
    expect(hub.drain("nobody")).toEqual([]);
  });

  // Contract parity: every hub-emitted frame parses as a server message.
  for (const message of suite.server_to_client) {
    test(`hub frames parse as contract messages: ${message.type}`, () => {
      const hub = new FlagHubCore({ "ledger-beta": true, other: false });
      hub.subscribe("s");
      if (message.type === "flag-update") {
        hub.setFlag(message.name as string, message.enabled as boolean);
      }
      const frames = hub.drain("s");
      for (const frame of frames) {
        const parsed = parseWsMessage(frame);
        expect(parsed).not.toBeNull();
        expect((parsed as { type: string }).type).toBe(message.type as string);
      }
    });
  }
});
