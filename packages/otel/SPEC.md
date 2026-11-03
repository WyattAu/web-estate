# @est/otel

DRAFT (tier k, last audit 2026-11-02)

Web telemetry conventions mirroring the `otelkit` crate where a browser
can participate: config shape and defaults, resource attributes, exporter
selection, deterministic sampling by trace id, and OTLP/HTTP-JSON span
documents. The Rust kit initializes a tracing stack; a browser cannot, so
export transport is an app concern (POST the span JSON to the collector).

## Truth table

| Concern             | Truth                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| Config defaults     | `conformance/otel/cases.json` (defaults case; mirrors TelemetryConfig::default) |
| Resource attributes | `conformance/otel/cases.json` (service.name per OTel semconv)                   |
| Exporter selection  | `conformance/otel/cases.json` (mirrors Exporter::from_str_opt)                  |
| Sampling semantics  | `conformance/otel/cases.json` (deterministic by trace id)                       |
| Span document       | `conformance/otel/cases.json` (OTLP/HTTP-JSON fields)                           |

## Requirements

- REQ-1: Defaults equal `TelemetryConfig::default()` (unknown / 0.0.0 /
  info / rate 1.0). Oracle: fixture defaults case.
- REQ-2: Resource attributes are exactly `service.name` = service_name
  (OTel semantic conventions). Oracle: fixture resource case.
- REQ-3: `exporterFrom` mirrors `Exporter::from_str_opt`: `otlp` -> Otlp,
  `stdout` -> Stdout, anything else undefined. Oracle: fixture exporter
  cases.
- REQ-4: Sampling is deterministic per trace id (same id, same decision);
  rate 1.0 samples all, 0.0 samples none, mid rates yield both outcomes.
  Oracle: fixture sample cases.
- REQ-5: Span documents carry OTLP fields (traceId 32 hex, spanId 16 hex,
  name, kind, nanosecond timestamps, typed attributes). Oracle: fixture
  span case.

## Out of scope

Span export transport, context propagation headers (traceparent) — the
W3C Trace Context header belongs in `@est/fetchkit` when an app traces
across the wire; Sentry; metrics.
