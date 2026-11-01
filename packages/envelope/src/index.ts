// @est/envelope: TS mirror of the WyattAu/json-envelope crate.
// Wire truth: conformance/envelope/cases.json.
// Wire keys are snake_case exactly as serde emits them (per_page, total_pages).

import { ERROR_CODES, type ErrorCodeName } from "@est/errcode";

/** API error details; wire-compatible with json-envelope::ApiError. */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Pagination metadata; snake_case on the wire (serde field names). */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

/** Standard API response envelope; wire-compatible with ApiResponse<T>. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: PaginationMeta;
}

export type DecodeResult<T> =
  | { ok: true; envelope: ApiResponse<T> }
  | { ok: false; reason: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function decodeApiError(v: unknown): ApiError | string {
  if (!isRecord(v)) return "error: not an object";
  const { code, message, details } = v;
  if (typeof code !== "string") return "error.code: not a string";
  if (typeof message !== "string") return "error.message: not a string";
  const out: ApiError = { code, message };
  if (details !== undefined) out.details = details;
  return out;
}

function decodePagination(v: unknown): PaginationMeta | string {
  if (!isRecord(v)) return "pagination: not an object";
  const { page, per_page, total, total_pages } = v;
  if (!Number.isInteger(page)) return "pagination.page: not an integer";
  if (!Number.isInteger(per_page)) return "pagination.per_page: not an integer";
  if (typeof total !== "number") return "pagination.total: not a number";
  if (!Number.isInteger(total_pages)) return "pagination.total_pages: not an integer";
  return { page, per_page, total, total_pages };
}

/**
 * Strict decode of an unknown payload into ApiResponse<T>.
 * Rejects: failure without error, success with error, missing/non-bool
 * success, camelCase pagination keys. Matches the conformance fixtures.
 */
export function decodeEnvelope<T = unknown>(input: unknown): DecodeResult<T> {
  if (!isRecord(input)) return { ok: false, reason: "envelope: not an object" };
  const { success, data, error, pagination } = input;
  if (typeof success !== "boolean") return { ok: false, reason: "success: not a boolean" };

  let err: ApiError | undefined;
  if (error !== undefined) {
    const decoded = decodeApiError(error);
    if (typeof decoded === "string") return { ok: false, reason: decoded };
    if (!success) {
      // The one shape a failure is allowed to take.
    } else {
      return { ok: false, reason: "success:true with error object" };
    }
    err = decoded;
  }
  if (!success && err === undefined) return { ok: false, reason: "success:false without error" };

  let pag: PaginationMeta | undefined;
  if (pagination !== undefined) {
    const decoded = decodePagination(pagination);
    if (typeof decoded === "string") return { ok: false, reason: decoded };
    pag = decoded;
  }

  const envelope: ApiResponse<T> = { success };
  if (data !== undefined) envelope.data = data as T;
  if (err !== undefined) envelope.error = err;
  if (pag !== undefined) envelope.pagination = pag;
  return { ok: true, envelope };
}

/** Successful envelope; error/pagination keys are omitted, not null. */
export function envelopeSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/** Paginated success envelope. */
export function envelopePaginated<T>(data: T, pagination: PaginationMeta): ApiResponse<T> {
  return { success: true, data, pagination };
}

/** Error envelope from an errcode variant; omit keys on a plain encode. */
export function envelopeError(
  code: ErrorCodeName | string,
  message: string,
  details?: unknown,
): ApiResponse<never> {
  const err: ApiError = {
    code: typeof code === "string" ? code : ERROR_CODES[code].code,
    message,
  };
  if (details !== undefined) err.details = details;
  return { success: false, error: err };
}

/** Type guard narrowing a decoded envelope to the error side. */
export function isEnvelopeError<T>(
  env: ApiResponse<T>,
): env is ApiResponse<T> & { success: false; error: ApiError } {
  return env.success === false;
}
