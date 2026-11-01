import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";

// Static-first: every entity page is prerendered HTML with JSON-LD and a
// sitemap entry, the shape proven by tabworthy.pages.dev. Interactivity is
// islands only (Solid), logic heavy-lifting is @est kits.
export default defineConfig({
  site: "https://directory.web-estate.wyattau.dev",
  integrations: [solid(), sitemap()],
});
