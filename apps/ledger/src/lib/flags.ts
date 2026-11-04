// Flags + API wiring for the ledger app. flagsd is configured via
// PUBLIC_FLAGSD_BASE at build time; when unset/unreachable, the flags
// client fails closed and the UI says so (the honest default).
import { createFlagsClient } from "@est/flags";

const FALLBACK_FLAGSD = "https://flagsd.invalid";

export const FLAGSD_BASE = import.meta.env.PUBLIC_FLAGSD_BASE ?? FALLBACK_FLAGSD;
export const DIRECTORY_API_BASE = "https://web-estate-directory-api.wyatt-au.workers.dev";

export const flags = createFlagsClient({
  baseUrl: FLAGSD_BASE,
  defaults: { "ledger-beta": false },
});
