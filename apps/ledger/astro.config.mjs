import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://ledger.web-estate.wyattau.dev",
  integrations: [solid(), sitemap()],
});
