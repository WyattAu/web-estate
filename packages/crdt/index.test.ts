import { describe, expect, test } from "bun:test";
import cases from "../../conformance/crdt/cases.json";
import { CrdtDocument, compareIds, RgaString, type TextOperation } from "./src/index";

type Action =
  | { site?: number; op: "insert"; index: number; content: string }
  | { site?: number; op: "delete"; index: number; len: number };

type Group = {
  /** parallel: sites act on a snapshot of the log (no cross-visibility).
   * sequential: every action sees all prior ops. */
  mode: "parallel" | "sequential";
  /** One action list per acting site; site defaults to the list's position. */
  sites: Action[][];
  /** Expected rendered text after this group's ops are fully synced. */
  expected: string;
};

type Scenario = { name: string; groups: Group[] };

const suite = cases as unknown as { suite: string; scenarios: Scenario[] };

function siteView(log: TextOperation[]): RgaString {
  const rga = new RgaString();
  for (const op of log) rga.apply(op);
  return rga;
}

function act(siteId: number, view: RgaString, action: Action, log: TextOperation[]): void {
  const ops =
    action.op === "insert"
      ? view.insert(siteId, action.index, action.content)
      : view.delete(siteId, action.index, action.len);
  log.push(...ops);
}

function render(log: TextOperation[]): string {
  const fresh = new RgaString();
  for (const op of log) fresh.apply(op);
  return fresh.text();
}

describe("conformance: crdt", () => {
  test("fixture suite is crdt", () => {
    expect(suite.suite).toBe("crdt");
  });

  for (const scenario of suite.scenarios) {
    test(`scenario: ${scenario.name}`, () => {
      const log: TextOperation[] = [];
      for (const group of scenario.groups) {
        if (group.mode === "parallel") {
          // Concurrent: every site snapshots the log as it stands, acts on
          // its own view (chaining its own edits), and ops are merged only
          // after all sites have acted.
          const base = [...log];
          const newOps: TextOperation[] = [];
          group.sites.forEach((actions, gi) => {
            const siteDefault = gi + 1;
            const view = siteView(base);
            for (const action of actions) {
              act(action.site ?? siteDefault, view, action, newOps);
            }
          });
          log.push(...newOps);
        } else {
          // Sequential: each action sees every prior op.
          let fallbackSite = 1;
          for (const actions of group.sites) {
            for (const action of actions) {
              act(action.site ?? fallbackSite, siteView(log), action, log);
              fallbackSite = action.site ?? fallbackSite + 1;
            }
          }
        }
        expect(render(log)).toBe(group.expected);
      }
    });
  }

  test("id order is site-major then counter", () => {
    expect(compareIds({ site_id: 1, counter: 5 }, { site_id: 2, counter: 1 })).toBeLessThan(0);
    expect(compareIds({ site_id: 2, counter: 1 }, { site_id: 2, counter: 3 })).toBeLessThan(0);
    expect(compareIds({ site_id: 2, counter: 3 }, { site_id: 2, counter: 3 })).toBe(0);
  });
});

describe("crdt document", () => {
  test("local edits bump version and broadcast ops", () => {
    const doc = new CrdtDocument("doc-1");
    doc.join(1, "alice");
    const { ops, version } = doc.insertText(1, 0, "Hi");
    expect(ops).toHaveLength(2);
    expect(version).toBe(1);
    expect(doc.text).toBe("Hi");
    expect(doc.participants().map((p) => p.name)).toEqual(["alice"]);
  });

  test("remote ops ingest and bump version", () => {
    const a = new CrdtDocument("doc-1");
    const b = new CrdtDocument("doc-1");
    a.join(1, "alice");
    const { ops } = a.insertText(1, 0, "causal");
    expect(b.applyOps(ops)).toBe(1);
    expect(b.text).toBe("causal");
    const del = a.deleteText(1, 0, 6);
    expect(b.applyOps(del.ops)).toBe(2);
    expect(b.text).toBe("");
  });
});
