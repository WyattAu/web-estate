import { describe, expect, test } from "bun:test";
import cases from "../../conformance/flags/cases.json";
import { createFlagsClient, evaluateUrl } from "./src/index";

type EvalCase = {
  kind: "evaluate";
  name: string;
  flag: string;
  status: number;
  body: Record<string, unknown>;
  expect: { enabled: boolean; source: string };
};
type UrlCase = {
  kind: "url";
  flag: string;
  subject: { user?: string; org?: string };
  expected_query: string;
};
type Case = EvalCase | UrlCase;

const suite = cases as unknown as {
  suite: string;
  defaults: Record<string, boolean>;
  cases: Case[];
};

const BASE = "https://flagsd.test";

function clientFor(status: number, body: Record<string, unknown>, captured: { url?: string } = {}) {
  return createFlagsClient({
    baseUrl: BASE,
    defaults: suite.defaults,
    maxRetries: 0,
    fetchImpl: (async (input: string | URL | Request) => {
      captured.url = String(input);
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch,
  });
}

describe("conformance: flags", () => {
  test("fixture suite is flags", () => {
    expect(suite.suite).toBe("flags");
  });

  for (const c of suite.cases) {
    if (c.kind === "evaluate") {
      test(`evaluate: ${c.name}`, async () => {
        const decision = await clientFor(c.status, c.body).evaluate(c.flag);
        expect(String(decision.enabled)).toBe(String(c.expect.enabled));
        expect(String(decision.source)).toBe(c.expect.source);
      });
    } else {
      test(`url: flag=${c.flag} subject=${JSON.stringify(c.subject)}`, () => {
        const u = new URL(evaluateUrl(BASE, c.flag, c.subject));
        expect(u.pathname).toBe(`/evaluate/${c.flag}`);
        expect(u.search.replace(/^\?/, "")).toBe(c.expected_query);
      });
    }
  }

  test("subject params reach the wire", async () => {
    const captured: { url?: string } = {};
    const client = clientFor(200, { name: "beta-ui", enabled: false }, captured);
    await client.isEnabled("beta-ui", { user: "u1", org: "acme" });
    expect(captured.url).toContain("user=u1");
    expect(captured.url).toContain("org=acme");
  });
});
