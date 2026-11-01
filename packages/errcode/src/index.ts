// @est/errcode: TS mirror of the WyattAu/errcode crate.
// Wire truth: conformance/errcode/cases.json (both languages pass it).

/**
 * The 10 error code variants, named exactly as the Rust enum.
 * `Auth` is the historical generic 401; prefer `Unauthorized`.
 */
export const ERROR_CODE_NAMES = [
  "NotFound",
  "Conflict",
  "Validation",
  "Auth",
  "Unauthorized",
  "Forbidden",
  "Internal",
  "RateLimited",
  "BadRequest",
  "Unavailable",
] as const;

export type ErrorCodeName = (typeof ERROR_CODE_NAMES)[number];

export interface ErrorCodeDef {
  /** HTTP status code. */
  readonly status: number;
  /** Canonical machine-readable string, e.g. "NOT_FOUND". */
  readonly code: string;
  /** Canonical reason phrase, safe to expose to clients. */
  readonly reason: string;
  /** `type` URI per RFC 7807. */
  readonly typeUri: string;
}

/**
 * The exact mapping table from the Rust crate. Fixtures verify every cell;
 * edits here must regenerate the fixture or fail conformance.
 */
export const ERROR_CODES: Readonly<Record<ErrorCodeName, ErrorCodeDef>> = {
  NotFound: {
    status: 404,
    code: "NOT_FOUND",
    reason: "Not Found",
    typeUri: "https://httpstatuses.com/404",
  },
  Conflict: {
    status: 409,
    code: "CONFLICT",
    reason: "Conflict",
    typeUri: "https://httpstatuses.com/409",
  },
  Validation: {
    status: 422,
    code: "VALIDATION",
    reason: "Validation Error",
    typeUri: "https://httpstatuses.com/422",
  },
  Auth: {
    status: 401,
    code: "AUTH",
    reason: "Unauthorized",
    typeUri: "https://httpstatuses.com/401",
  },
  Unauthorized: {
    status: 401,
    code: "UNAUTHORIZED",
    reason: "Unauthorized",
    typeUri: "https://httpstatuses.com/401",
  },
  Forbidden: {
    status: 403,
    code: "FORBIDDEN",
    reason: "Forbidden",
    typeUri: "https://httpstatuses.com/403",
  },
  Internal: {
    status: 500,
    code: "INTERNAL",
    reason: "Internal Server Error",
    typeUri: "https://httpstatuses.com/500",
  },
  RateLimited: {
    status: 429,
    code: "RATE_LIMITED",
    reason: "Too Many Requests",
    typeUri: "https://httpstatuses.com/429",
  },
  BadRequest: {
    status: 400,
    code: "BAD_REQUEST",
    reason: "Bad Request",
    typeUri: "https://httpstatuses.com/400",
  },
  Unavailable: {
    status: 503,
    code: "UNAVAILABLE",
    reason: "Service Unavailable",
    typeUri: "https://httpstatuses.com/503",
  },
};

/** Look up a code definition by variant name. */
export function errcode(name: ErrorCodeName): ErrorCodeDef {
  return ERROR_CODES[name];
}

/** RFC 7807 Problem Details, wire-compatible with errcode::ProblemDetail. */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

/** Build a ProblemDetail; absent detail/instance keys are omitted on the wire. */
export function makeProblem(
  name: ErrorCodeName,
  opts: { detail?: string; instance?: string } = {},
): ProblemDetail {
  const def = ERROR_CODES[name];
  const problem: ProblemDetail = {
    type: def.typeUri,
    title: def.reason,
    status: def.status,
  };
  if (opts.detail !== undefined) problem.detail = opts.detail;
  if (opts.instance !== undefined) problem.instance = opts.instance;
  return problem;
}

/** Rust Display format: "{reason} ({status})". */
export function display(name: ErrorCodeName): string {
  const def = ERROR_CODES[name];
  return `${def.reason} (${def.status})`;
}
