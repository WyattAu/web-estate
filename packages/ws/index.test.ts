import { describe, expect, test } from "bun:test";
import cases from "../../conformance/ws/cases.json";
import { parseWsMessage, serializeWsMessage, type WsMessage } from "./src/index";

type SchemaCase = {
  kind: "parse" | "serialize";
  wire?: string;
  valid?: boolean;
  decoded?: Record<string, unknown>;
  message?: Record<string, unknown>;
  expected?: string;
};

const suite = cases as unknown as {
  suite: string;
  schema_cases: SchemaCase[];
};

describe("conformance: ws", () => {
  test("fixture suite is ws", () => {
    expect(suite.suite).toBe("ws");
  });

  for (const c of suite.schema_cases) {
    if (c.kind === "parse") {
      test(`parse ${c.wire?.slice(0, 40)} -> ${c.valid ? "valid" : "null"}`, () => {
        const decoded = parseWsMessage(c.wire!) as unknown;
        if (c.valid) {
          expect(decoded).toEqual(c.decoded);
        } else {
          expect(decoded).toBeNull();
        }
      });
    } else {
      test(`serialize ${JSON.stringify(c.message)}`, () => {
        const expected = c.expected as string;
        expect(serializeWsMessage(c.message as unknown as WsMessage)).toBe(expected);
      });
    }
  }

  test("round-trip: every client message survives serialize+parse", () => {
    const messages: WsMessage[] = [
      { type: "subscribe", flags: ["a", "b"] },
      { type: "unsubscribe", flags: [] },
      { type: "ping" },
      { type: "flag-update", name: "x", enabled: true },
      { type: "pong" },
      { type: "hello", flags: { a: true } },
    ];
    for (const message of messages) {
      const parsed = parseWsMessage(serializeWsMessage(message));
      expect(parsed).toEqual(message);
    }
  });
});
