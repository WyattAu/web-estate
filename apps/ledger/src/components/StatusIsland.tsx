// Status island: a real fetchkit envelope round trip to the deployed
// directory-api; failures render the errcode, never a blank card.

import { errcode } from "@est/errcode";
import { createFetchKit } from "@est/fetchkit";
import { createResource } from "solid-js";
import { DIRECTORY_API_BASE } from "../lib/flags";
import { tt } from "../lib/i18n";

const kit = createFetchKit({
  retry: { maxRetries: 1, initialDelayMs: 150, maxDelayMs: 500, jitter: false },
});

type Outcome = Awaited<ReturnType<typeof kit.fetchEnvelopeWithMeta<{ sites: number }>>>;

function statusText(loading: boolean, error: unknown, outcome: Outcome | undefined): string {
  if (loading) return tt("status.checking");
  if (error !== undefined || !outcome) {
    return `${tt("status.down")} — ${errcode("Unavailable").code}`;
  }
  if (outcome.envelope.success && outcome.envelope.data) {
    return `${tt("status.live")} — ${outcome.envelope.data.sites} sites (attempts ${outcome.attempts})`;
  }
  return `${tt("status.down")} — ${outcome.envelope.error?.code ?? errcode("Unavailable").code}`;
}

export default function StatusIsland() {
  const [health] = createResource(async () => {
    const out = await kit.fetchEnvelopeWithMeta<{ sites: number }>(
      `${DIRECTORY_API_BASE}/api/health`,
    );
    return out;
  });

  const ok = !health.loading && health.error === undefined && health()?.envelope.success === true;

  return (
    <div class="card">
      <h3>{tt("status.heading")}</h3>
      <p>
        <span class="dot" classList={{ ok, down: !ok }}>
          ●
        </span>{" "}
        {statusText(health.loading, health.error, health.latest)}
      </p>
      <p class="muted">{DIRECTORY_API_BASE}</p>
    </div>
  );
}
