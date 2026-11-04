import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://ledger.web-estate.wyattau.dev",
  integrations: [solid(), sitemap()],
});
