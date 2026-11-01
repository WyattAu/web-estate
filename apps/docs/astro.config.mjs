import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://docs.web-estate.wyattau.dev",
  integrations: [
    starlight({
      title: "Web Estate",
      description: "The WyattAu web frontend estate: TS + SolidJS + Astro + Starlight under Bun.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/WyattAu/web-estate" }],
      sidebar: [
        {
          label: "Estate",
          items: [
            { slug: "handbook", label: "Handbook" },
            { slug: "conformance", label: "Conformance" },
          ],
        },
        {
          label: "Kits",
          items: [
            { slug: "kits/errcode", label: "@est/errcode" },
            { slug: "kits/envelope", label: "@est/envelope" },
            { slug: "kits/search", label: "@est/search" },
          ],
        },
      ],
    }),
  ],
});
