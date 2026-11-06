// W3C Trace Context: traceparent generation and validation per the W3C
// Trace Context specification (version 00, lowercase hex, nonzero ids).

export interface TraceContext {
  /** 32 lowercase hex chars, not all zeroes. */
  traceId: string;
  /** 16 lowercase hex chars, not all zeroes. */
  spanId: string;
  /** The full traceparent header value: `00-<traceId>-<spanId>-01`. */
  traceparent: string;
}

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE = /^[0-9a-f]{16}$/;

function randomHex(chars: number): string {
  let out = "";
  for (let i = 0; i < chars; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function isAllZero(hex: string): boolean {
  return /^0+$/.test(hex);
}

/** Generate a fresh valid trace context (W3C traceparent version 00). */
export function generateTraceContext(): TraceContext {
  let traceId = randomHex(32);
  let spanId = randomHex(16);
  while (isAllZero(traceId)) {
    traceId = randomHex(32);
  }
  while (isAllZero(spanId)) {
    spanId = randomHex(16);
  }
  const traceparent = `00-${traceId}-${spanId}-01`;
  return { traceId, spanId, traceparent };
}

/** Validate a traceparent header per W3C Trace Context level 1. */
export function isValidTraceparent(header: string): boolean {
  const parts = header.split("-");
  if (parts.length !== 4) return false;
  const [version, traceId, spanId, flags] = parts;
  if (version === "ff") return false;
  if (version === "00" && flags !== "01") return false;
  if (!TRACE_ID_RE.test(traceId ?? "") || !SPAN_ID_RE.test(spanId ?? "")) return false;
  return !isAllZero(traceId ?? "") && !isAllZero(spanId ?? "");
}

/** Extract the trace/span ids from a valid traceparent header. */
export function parseTraceparent(header: string): TraceContext | null {
  if (!isValidTraceparent(header)) return null;
  const [, , traceId, spanId] = header.split("-");
  return { traceId: traceId ?? "", spanId: spanId ?? "", traceparent: header };
}
