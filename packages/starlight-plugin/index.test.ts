import { describe, expect, test } from "bun:test";
import cases from "../../conformance/starlight-plugin/cases.json";
import {
  createStarlightPlugin,
  DEFAULT_CONFIG,
  mergeConfigs,
  type SharedConfig,
} from "./src/index";

type MergeCase = {
  name: string;
  overrides: Partial<SharedConfig>[];
  expected: Record<string, unknown>;
};
type PluginCase = {
  name: string;
  definition: {
    name: string;
    config?: Partial<SharedConfig>;
    applySets: Record<string, unknown>;
  };
  expectedUpdate: Record<string, unknown>;
  expectedMergedBase: string;
  expectedMergedFeatures: Record<string, unknown>;
};

const suite = cases as unknown as {
  suite: string;
  merge_cases: MergeCase[];
  plugin_cases: PluginCase[];
};

describe("conformance: starlight-plugin", () => {
  test("fixture suite is starlight-plugin", () => {
    expect(suite.suite).toBe("starlight-plugin");
  });

  test("defaults mirror starlight-kit DEFAULT_CONFIG", () => {
    expect(DEFAULT_CONFIG).toEqual({ base: "/", features: {}, labels: {} });
  });

  for (const c of suite.merge_cases) {
    test(`merge: ${c.name}`, () => {
      const merged = mergeConfigs(DEFAULT_CONFIG as SharedConfig, ...c.overrides);
      expect(merged).toEqual(c.expected);
    });
  }

  for (const c of suite.plugin_cases) {
    test(`plugin: ${c.name}`, () => {
      let updated: Record<string, unknown> | undefined;
      const plugin = createStarlightPlugin({
        name: c.definition.name,
        ...(c.definition.config ? { config: c.definition.config } : {}),
        apply: (config) => {
          // The apply callback sees the fully merged config.
          expect(config.base).toBe(c.expectedMergedBase);
          expect(config.features as Record<string, unknown>).toEqual(c.expectedMergedFeatures);
          return c.definition.applySets;
        },
      });
      expect(plugin.name).toBe(c.definition.name);
      plugin.hooks["config:setup"]({ updateConfig: (u) => (updated = u) });
      expect(updated).toEqual(c.expectedUpdate);
    });
  }
});
