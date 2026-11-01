# @est/fetchkit

DRAFT (tier k, last audit 2026-11-01)

Fetch pipeline for estate backends: retry with exponential backoff (TS
mirror of the `retry-backoff` crate), envelope decoding via `@est/envelope`,
and HTTP failure mapping onto `@est/errcode`. Cache semantics are out of
scope; they belong to a future `@est/cachekit`.

## Truth table

| Concern                                | Truth                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| Backoff formula and defaults           | `conformance/fetchkit/cases.json` (mirrors `retry-backoff::config`) |
| Status to errcode table, retryable set | `conformance/fetchkit/cases.json` (status cases)                    |
| Retry loop shape                       | `conformance/fetchkit/cases.json` (flow cases)                      |
| Public API                             | `src/index.ts`                                                      |

## Requirements

- REQ-1: `delayForAttempt` equals `retry-backoff::RetryConfig::delay_for_attempt`:
  `initial * multiplier^attempt` capped at `maxDelay`, plus at most 10%
  additive jitter when enabled. Oracle: fixture delay cases + jitter bound
  test.
- REQ-2: Defaults equal `RetryConfig::default()` (3 retries, 100ms, 5s cap,
  2.0x, jitter on). Oracle: fixture defaults test.
- REQ-3: Retryable set is network errors, 429, and 5xx; all other statuses
  stop the loop on the first attempt. Oracle: fixture status and flow cases.
- REQ-4: A server error envelope is passed through verbatim in preference
  to the locally synthesized one. Oracle: unit test
  (`server error envelope is preferred`).
- REQ-5: A 2xx body that is not an envelope becomes an Internal error
  envelope (protocol violation, no crash). Oracle: unit test.
- REQ-6: The loop returns attempts metadata and an exhausted flag;
  `maxRetries: 0` performs exactly one attempt. Oracle: fixture flow cases.

## Out of scope

Caching (future `@est/cachekit`), request signing/auth, streaming bodies.
