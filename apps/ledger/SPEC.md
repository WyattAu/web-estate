# ledger

DRAFT (tier a; application with normative display rules, 2026-11-02)

The Phase 3 consumer suite: an Astro + Solid dashboard composing the web
estate's money, flags, i18n, envelope, errcode, and fetchkit kits.

## What it normatively does

- RULE-1: Allocation renders parts whose sum equals the total exactly
  (the UI asserts the invariant and shows the sum). Oracle: `@est/money`
  fixtures + the island's sum display.
- RULE-2: Feature flags fail closed; the UI surfaces the decision source
  (`default` vs `remote`) rather than hiding it. Oracle: flags fixtures +
  the island's source chip.
- RULE-3: Status comes from a real fetchkit round trip against the
  deployed directory-api; failures render the errcode, never a blank.
  Oracle: the deployed page's status card.

## Deploy

`PUBLIC_FLAGSD_BASE=https://web-estate-flags-edge.wyatt-au.workers.dev bun x astro build` then
`bun run deploy` (wrangler pages, project `web-estate-ledger`). The flags
island evaluates against the flags-edge worker; without the env var the
client fails closed to `flagsd.invalid`.
