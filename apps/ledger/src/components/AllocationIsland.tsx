// The allocation island: the money kit doing its real job in the browser.
// Exact BigInt decimals; parts sum preserved; UI shows the invariant.

import { createMemo, createSignal, For, Show } from "solid-js";
import { allocateStrings, MoneyError, moneyToString, parseMoney } from "@est/money";
import { LOCALES, locale, setLocale, tt } from "../lib/i18n";

const CURRENCY = "USD" as const;

export default function AllocationIsland() {
  const [amount, setAmount] = createSignal("100.00");
  const [ratios, setRatios] = createSignal("1,1,1");
  const [error, setError] = createSignal<string | null>(null);

  const result = createMemo(() => {
    const text = amount().trim();
    const ratioList = ratios()
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (!text || ratioList.length === 0) return null;
    try {
      const total = parseMoney(text, CURRENCY);
      const parts = allocateStrings(total, ratioList);
      const sum = parts.reduce((acc, p) => acc + p.mantissa, 0n);
      setError(null);
      return { parts, sum, sumMatches: sum === total.mantissa, total };
    } catch (e) {
      setError(e instanceof MoneyError ? e.message : String(e));
      return null;
    }
  });

  return (
    <section>
      <h2>{tt("alloc.heading")}</h2>
      <p class="muted">{tt("ledger.subtitle")}</p>

      <div style={{ display: "flex", gap: "0.6rem", "flex-wrap": "wrap", "margin-bottom": "0.8rem" }}>
        <label style={{ flex: "1 1 12rem" }}>
          <div class="lbl">{tt("alloc.amount")}</div>
          <input value={amount()} onInput={(e) => setAmount(e.currentTarget.value)} />
        </label>
        <label style={{ flex: "1 1 12rem" }}>
          <div class="lbl">{tt("alloc.ratios")}</div>
          <input value={ratios()} onInput={(e) => setRatios(e.currentTarget.value)} />
        </label>
        <label style={{ flex: "0 0 8rem" }}>
          <div class="lbl">locale</div>
          <select value={locale()} onChange={(e) => setLocale(e.currentTarget.value as (typeof LOCALES)[number])}>
            <For each={LOCALES}>{(l) => <option value={l}>{l}</option>}</For>
          </select>
        </label>
      </div>

      <Show when={error()}>
        <p role="alert" class="err">
          {tt("alloc.error")}: {error()}
        </p>
      </Show>

      <Show when={result()} keyed>
        {(r) => (
          <div>
            <p class="muted" style={{ "margin-bottom": "0.5rem" }}>
              {tt("alloc.parts")} | sum ={" "}
              <b>
                {moneyToString({
                  mantissa: r.sum,
                  scale: r.total.scale,
                  currency: CURRENCY,
                })}
              </b>{" "}
              <Show when={r.sumMatches}>
                <span class="ok">= {moneyToString(r.total)} ✓</span>
              </Show>
            </p>
            <div class="grid">
              <For each={r.parts}>
                {(part, i) => (
                  <div class="card">
                    <div class="lbl">#{i() + 1}</div>
                    <div class="big">{moneyToString(part)}</div>
                  </div>
                )}
              </For>
            </div>
          </div>
        )}
      </Show>
    </section>
  );
}
