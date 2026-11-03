import { describe, expect, test } from "bun:test";
import cases from "../../conformance/otel/cases.json";
import {
  exporterFrom,
  makeSpan,
  resourceAttributes,
  shouldSample,
  TELEMETRY_DEFAULTS,
  type TelemetryConfig,
} from "./src/index";

type DefaultsCase = { kind: "defaults"; expected: Record<string, unknown> };
type ResourceCase = {
  kind: "resource";
  config: Record<string, string>;
  expected_attributes: { key: string; value: Record<string, string> }[];
};
type ExporterCase = { kind: "exporter"; input: string; expected: string | null };
type SampleCase = {
  kind: "sample";
  rate: number;
  all?: boolean;
  deterministic?: boolean;
};
type SpanCase = {
  kind: "span";
  name: string;
  attributes: Record<string, string>;
  expect_fields: string[];
};
type Case = DefaultsCase | ResourceCase | ExporterCase | SampleCase | SpanCase;

const suite = cases as unknown as { suite: string; cases: Case[] };

function configWith(overrides: Record<string, string>): TelemetryConfig {
  return {
    ...TELEMETRY_DEFAULTS,
    service_name: overrides.service_name ?? TELEMETRY_DEFAULTS.service_name,
    service_version: overrides.service_version ?? TELEMETRY_DEFAULTS.service_version,
  };
}

describe("conformance: otel", () => {
  test("fixture suite is otel", () => {
    expect(suite.suite).toBe("otel");
  });

  for (const c of suite.cases) {
    if (c.kind === "defaults") {
      test("defaults mirror TelemetryConfig::default", () => {
        expect(String(TELEMETRY_DEFAULTS.service_name)).toBe(String(c.expected.service_name));
        expect(String(TELEMETRY_DEFAULTS.service_version)).toBe(String(c.expected.service_version));
        expect(String(TELEMETRY_DEFAULTS.log_level)).toBe(String(c.expected.log_level));
        expect(TELEMETRY_DEFAULTS.sample_rate).toBe(c.expected.sample_rate as number);
      });
    } else if (c.kind === "resource") {
      test("resource attributes carry service.name", () => {
        expect(JSON.parse(JSON.stringify(resourceAttributes(configWith(c.config))))).toEqual(
          c.expected_attributes,
        );
      });
    } else if (c.kind === "exporter") {
      test(`exporter "${c.input}" -> ${c.expected ?? "None"}`, () => {
        const got = exporterFrom(c.input) ?? null;
        expect(got === null ? null : String(got)).toBe(c.expected);
      });
    } else if (c.kind === "sample") {
      test(`sample rate ${c.rate}${c.all !== undefined ? (c.all ? " samples all" : " samples none") : ""}`, () => {
        const cfg: TelemetryConfig = { ...TELEMETRY_DEFAULTS, sample_rate: c.rate };
        const ids = Array.from({ length: 64 }, (_, i) => `trace-${i.toString().padStart(3, "0")}`);
        const decisions = ids.map((id) => shouldSample(cfg, id));
        if (c.all !== undefined) {
          expect(decisions.every((d) => d === c.all)).toBe(true);
        }
        if (c.deterministic) {
          // Stability: identical ids decide identically; both outcomes
          // present at a mid rate.
          for (const id of ids) {
            expect(shouldSample(cfg, id)).toBe(shouldSample(cfg, id));
          }
          expect(new Set(decisions).size).toBe(2);
        }
      });
    } else {
      test(`span document carries OTLP fields for ${c.name}`, () => {
        const span = makeSpan("a".repeat(32), c.name, c.attributes, 1000, 2000);
        for (const field of c.expect_fields) {
          expect(Object.hasOwn(span, field)).toBe(true);
        }
        expect(span.traceId).toHaveLength(32);
        expect(span.spanId).toHaveLength(16);
        expect(span.startTimeUnixNano).toBe("1000000000");
        expect(span.attributes).toEqual([
          { key: "http.method", value: { stringValue: "GET" } },
          { key: "url.path", value: { stringValue: "/api/search" } },
        ]);
      });
    }
  }
});
