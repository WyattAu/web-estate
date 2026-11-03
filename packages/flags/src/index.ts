// @est/flags: client for the estate's flagsd evaluation API.
// Wire truth: conformance/flags/cases.json (mirrors flagsd's
// GET /evaluate/{name}?user=&org= -> {name, enabled}).
// Failure policy: fail closed to defaults[name] ?? false; a remote
// decision always wins when it parses.

import { createFetchKit, type FetchKit } from "@est/fetchkit";

export interface FlagsSubject {
  user?: string;
  org?: string;
}

export interface FlagDecision {
  name: string;
  enabled: boolean;
  /** "remote" = flagsd answered; "default" = failed closed. */
  source: "remote" | "default";
  reason?: string;
}

export interface FlagsOptions {
  /** flagsd base URL, e.g. https://flagsd.example.com */
  baseUrl: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Per-flag defaults consulted when evaluation is unavailable. */
  defaults?: Record<string, boolean>;
  /** Retry overrides handed to the underlying FetchKit. */
  maxRetries?: number;
}

export interface FlagsClient {
  evaluate(name: string, subject?: FlagsSubject): Promise<FlagDecision>;
  isEnabled(name: string, subject?: FlagsSubject): Promise<boolean>;
}

/** Build the evaluation URL; subject params are optional and ordered. */
export function evaluateUrl(baseUrl: string, name: string, subject?: FlagsSubject): string {
  const params = new URLSearchParams();
  if (subject?.user) params.set("user", subject.user);
  if (subject?.org) params.set("org", subject.org);
  const qs = params.toString();
  return `${baseUrl.replace(/\/+$/, "")}/evaluate/${encodeURIComponent(name)}${qs ? `?${qs}` : ""}`;
}

function isFlagBody(v: unknown): v is { name?: unknown; enabled: boolean } {
  return (
    typeof v === "object" && v !== null && typeof (v as { enabled?: unknown }).enabled === "boolean"
  );
}

export function createFlagsClient(options: FlagsOptions): FlagsClient {
  const kit: FetchKit = createFetchKit({
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    retry: { maxRetries: options.maxRetries ?? 1 },
  });
  const defaults = options.defaults ?? {};

  return {
    async evaluate(name: string, subject?: FlagsSubject): Promise<FlagDecision> {
      try {
        const out = await kit.fetchJsonWithMeta<{ enabled?: unknown }>(
          evaluateUrl(options.baseUrl, name, subject),
        );
        if (out.ok && out.body !== undefined && isFlagBody(out.body)) {
          return { name, enabled: out.body.enabled, source: "remote" };
        }
      } catch {
        // Network/transport failure: fail closed below.
      }
      const decision: FlagDecision = {
        name,
        enabled: defaults[name] ?? false,
        source: "default",
        reason: "unavailable",
      };
      return decision;
    },

    async isEnabled(name: string, subject?: FlagsSubject): Promise<boolean> {
      return (await this.evaluate(name, subject)).enabled;
    },
  };
}
