// @est/starlight-plugin: the extraction of starlight-kit's plugin factory
// and shared config (starlight-plugin-factory + shared-config + the
// multi-site merge semantics). One definePlugin helper, validated config
// merge with deep features/labels semantics, zero behavior change from
// the source repos.

export interface SharedConfig {
  /** Base path for the site. */
  base?: string;
  /** Feature flags; merged per-key (override wins per key). */
  features?: Record<string, boolean>;
  /** UI labels; merged per-key (override wins per key). */
  labels?: Record<string, string>;
  /** Arbitrary passthrough for other plugins. */
  [key: string]: unknown;
}

export const DEFAULT_CONFIG: Readonly<SharedConfig> = {
  base: "/",
  features: {},
  labels: {},
};

const DEEP_KEYS = new Set(["features", "labels"]);

/** Merge configs left to right. features/labels merge per-key; every
 * other key is overwritten by the override (mirrors starlight-kit). */
export function mergeConfigs(
  defaults: SharedConfig,
  ...overrides: Partial<SharedConfig>[]
): SharedConfig {
  const result: SharedConfig = { ...defaults };
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override)) {
      if (
        DEEP_KEYS.has(key) &&
        typeof value === "object" &&
        value !== null &&
        typeof result[key] === "object" &&
        result[key] !== null
      ) {
        result[key] = { ...(result[key] as object), ...(value as object) };
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export interface PluginDefinition {
  /** Unique name for the plugin. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Overrides applied over DEFAULT_CONFIG. */
  config?: Partial<SharedConfig>;
  /** Returns the Starlight config overrides for the merged config. */
  apply: (config: SharedConfig) => Record<string, unknown>;
}

export interface ConfigSetupContext {
  updateConfig: (config: Record<string, unknown>) => void;
}

/** Structural Starlight plugin type; no @astrojs/starlight dependency. */
export interface StarlightPlugin {
  name: string;
  hooks: {
    "config:setup"(context: ConfigSetupContext): void;
  };
}

/** The one plugin factory: merge config, apply in config:setup. */
export function createStarlightPlugin(definition: PluginDefinition): StarlightPlugin {
  const merged = mergeConfigs(DEFAULT_CONFIG as SharedConfig, definition.config ?? {});
  return {
    name: definition.name,
    hooks: {
      "config:setup"({ updateConfig }) {
        updateConfig(definition.apply(merged));
      },
    },
  };
}
