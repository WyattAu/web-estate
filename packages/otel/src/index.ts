// @est/otel: web telemetry conventions mirroring the otelkit crate.
// The Rust kit initializes a tracing stack; a browser cannot. What this
// kit mirrors is the normative part: the config shape and defaults, the
// resource attributes (service.name per OTel semantic conventions), the
// exporter enum, deterministic sampling by trace id, and OTLP/HTTP-JSON
// span documents ready to POST to a collector. Export transport is an
// app concern (fetch POST to the OTLP endpoint).

export interface TelemetryConfig {
  /** Logical name of the service; becomes resource attribute service.name. */
  service_name: string;
  service_version: string;
  log_level: string;
  /** Trace sample rate 0.0 - 1.0. */
  sample_rate: number;
  /** OTLP/HTTP collector endpoint, when exporting. */
  otlp_endpoint?: string;
}

/** Same defaults as otelkit::TelemetryConfig::default(). */
export const TELEMETRY_DEFAULTS: Readonly<TelemetryConfig> = {
  service_name: "unknown",
  service_version: "0.0.0",
  log_level: "info",
  sample_rate: 1.0,
};

/** Exporter selection, mirroring otelkit::Exporter (from_str_opt). */
export function exporterFrom(input: string): "Otlp" | "Stdout" | undefined {
  if (input === "otlp") return "Otlp";
  if (input === "stdout") return "Stdout";
  return undefined;
}

export type OtlpAttributeValue =
  | { stringValue: string }
  | { intValue: number }
  | { doubleValue: number }
  | { boolValue: boolean };

export interface OtlpAttribute {
  key: string;
  value: OtlpAttributeValue;
}

/** Resource attributes the Rust kit sets: service.name (OTel semconv). */
export function resourceAttributes(config: TelemetryConfig): OtlpAttribute[] {
  return [{ key: "service.name", value: { stringValue: config.service_name } }];
}

/** FNV-1a 32-bit; deterministic sampling input. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministic sampling: the same trace id always decides identically
 * for a given rate (matches a rate-limiting sampler's stability goal).
 */
export function shouldSample(config: TelemetryConfig, traceId: string): boolean {
  if (config.sample_rate >= 1) return true;
  if (config.sample_rate <= 0) return false;
  return fnv1a(traceId) / 0x100000000 < config.sample_rate;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpAttribute[];
}

function randomHex(chars: number): string {
  let out = "";
  for (let i = 0; i < chars; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

/** Build an OTLP/HTTP-JSON span document (kind 1 = internal). */
export function makeSpan(
  traceId: string,
  name: string,
  attributes: Record<string, string | number | boolean>,
  startMs: number,
  endMs: number,
): OtlpSpan {
  return {
    traceId,
    spanId: randomHex(16),
    name,
    kind: 1,
    startTimeUnixNano: String(startMs * 1_000_000),
    endTimeUnixNano: String(endMs * 1_000_000),
    attributes: Object.entries(attributes).map(([key, v]) => {
      if (typeof v === "number") return { key, value: { doubleValue: v } };
      if (typeof v === "boolean") return { key, value: { boolValue: v } };
      return { key, value: { stringValue: v } };
    }),
  };
}
