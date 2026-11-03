// Flags island: the fail-closed flagsd client with the decision source
// surfaced honestly (source: "default" vs "remote").

import { For, Show, createResource } from "solid-js";
import { flags } from "../lib/flags";
import { locale, tt } from "../lib/i18n";

type Decision = { name: string; enabled: boolean; source: string };

export default function FlagsIsland() {
  const [decisions, { refetch }] = createResource(async () => {
    const samples: { name: string; subject?: { user: string; org: string }; label: string }[] = [
      { name: "ledger-beta", label: "ledger-beta (global)" },
      {
        name: "ledger-beta",
        subject: { user: "demo", org: "estate" },
        label: "ledger-beta @ demo/estate",
      },
    ];
    const out: Decision[] = [];
    for (const s of samples) {
      const d = await flags.evaluate(s.name, s.subject);
      out.push({ name: s.label, enabled: d.enabled, source: d.source });
    }
    void locale;
    return out;
  });

  return (
    <div class="card">
      <h3>{tt("flags.heading")}</h3>
      <p class="muted">{tt("flags.desc")}</p>
      <Show
        when={!decisions.loading}
        fallback={<p class="muted">{tt("status.checking")}</p>}
      >
        <ul>
          <For each={decisions()}>
            {(d) => (
              <li>
                <code>{d.name}</code>: {d.enabled ? "on" : "off"}{" "}
                <span class="chip">{d.source}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <button type="button" onClick={() => refetch()}>
        re-evaluate
      </button>
    </div>
  );
}
