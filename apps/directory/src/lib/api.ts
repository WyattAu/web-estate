// The deployed directory API (Cloudflare Worker). Single place for the
// origin so the island and future clients share it. Override for local
// dev via the fallback logic in SearchIsland (live-first, local fallback).
export const DIRECTORY_API_BASE = "https://web-estate-directory-api.wyatt-au.workers.dev";
