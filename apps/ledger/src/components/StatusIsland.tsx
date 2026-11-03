// Status island: a real fetchkit envelope round trip to the deployed
// directory-api; failures render the errcode, never a blank card.

import { createResource } from "solid-js";
import { createFetchKit } from "@est/fetchkit";
import { errcode } from "@est/errcode";
import { DIRECTORY_API_BASE } from "../lib/flags";
import { tt } from "../lib/i18n";

const kit = createFetchKit({
  retry: { maxRetries: 1, initialDelayMs: 150, maxDelayMs: 500, jitter: false },
});

export default function StatusIsland() {
  const [health] = createResource(async () => {
    const out = await kit.fetchEnvelopeWithMeta<{ sites: number }>(
      `${DIRECTORY_API_BASE}/api/health`,
    );
    return out;
  });

  const ok = () =>
    !health.loading && !health.error && health()?.envelope.success === true;

  return (
    <div class="card">
      <h3>{tt("status.heading")}</h3>
      <p>
        <span
          class="dot"
          classList={{ ok: ok(), down: health.error !== undefined }}
        >
          ●
        </span>{" "}
        {health.loading
          ? tt("status.checking")
          : ok()
            ? `${tt("status.live")} — ${(health()!.envelope.data as { sites: number }).sites} sites (attempts ${health()!.attempts})`
            : `${tt("status.down")} — ${errcode("Unavailable").code}`}
      </p>
      <p class="muted">{DIRECTORY_API_BASE}</p>
    </div>
  );
}
