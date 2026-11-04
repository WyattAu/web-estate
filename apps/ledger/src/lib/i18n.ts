// Ledger i18n: one catalog object, both locales, via @est/i18n.
// App-level locale state (Solid signal) + the translator.

import { createI18n } from "@est/i18n";
import { createSignal } from "solid-js";

const labels = {
  en: {
    "ledger.title": "Estate ledger",
    "ledger.subtitle": "Exact decimal allocation, live flags, envelope status",
    "alloc.heading": "Allocation",
    "alloc.amount": "Total amount",
    "alloc.ratios": "Ratio weights (comma separated)",
    "alloc.error": "Allocation failed",
    "alloc.parts": "Parts (sum preserved exactly)",
    "status.heading": "System status",
    "status.live": "API reachable",
    "status.down": "API unreachable",
    "status.checking": "Checking...",
    "flags.heading": "Feature flags",
    "flags.desc": "flagsd evaluate; unreachable services fail closed",
    "flags.beta": "Beta surface",
    "flags.state": "state",
  },
  de: {
    "ledger.title": "Estate-Hauptbuch",
    "ledger.subtitle": "Exakte Dezimal-Aufteilung, live Flags, Envelope-Status",
    "alloc.heading": "Aufteilung",
    "alloc.amount": "Gesamtbetrag",
    "alloc.ratios": "Gewichte (kommagetrennt)",
    "alloc.error": "Aufteilung fehlgeschlagen",
    "alloc.parts": "Teile (Summe exakt erhalten)",
    "status.heading": "Systemstatus",
    "status.live": "API erreichbar",
    "status.down": "API nicht erreichbar",
    "status.checking": "Prüfe...",
    "flags.heading": "Feature-Flags",
    "flags.desc": "flagsd-Auswertung; nicht erreichbare Dienste fallen zu",
    "flags.beta": "Beta-Oberfläche",
    "flags.state": "Zustand",
  },
} as const;

const translator = createI18n(labels, "en");

export type LedgerLocale = keyof typeof labels;
export const LOCALES: LedgerLocale[] = ["en", "de"];

const [locale, setLocale] = createSignal<LedgerLocale>("en");

export { locale, setLocale };

export function tt(key: keyof (typeof labels)["en"]): string {
  return translator.translate(locale(), key);
}

export { translator as i18n, translator };
