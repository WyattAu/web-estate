// Data access over the scraped Tabworthy dataset. This module is the only
// place that knows the raw shape; pages consume the normalized exports.

import raw from "./data/sites.json";

export interface SiteRecord {
  slug: string;
  name: string | null;
  description: string | null;
  url: string | null;
  domain: string | null;
  /** Raw category with trailing slash, e.g. "design/". */
  category: string | null;
  tags: string[];
  featured_in: string[];
  related: string[];
  price: string | null;
}

export const sites: SiteRecord[] = (raw as SiteRecord[]).filter((s) => s.name && s.url);

export const CATEGORY_LABELS: Record<string, string> = {
  dev: "Developer",
  design: "Design & Type",
  learn: "Learn",
  fun: "Fun & Weird",
  games: "Games & Play",
  media: "Music & Audio",
  maps: "Maps & Earth",
  read: "Read & Archive",
  tools: "Everyday Tools",
  science: "Science & Space",
};

/** Normalized category id (no trailing slash). */
export function categoryId(site: SiteRecord): string {
  return (site.category ?? "tools").replace(/\/$/, "");
}

export function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? id;
}

export const categories: { id: string; label: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const s of sites) {
    const id = categoryId(s);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: categoryLabel(id), count }))
    .sort((a, b) => b.count - a.count);
})();

const bySlug = new Map(sites.map((s) => [s.slug, s]));

export function getSite(slug: string): SiteRecord | undefined {
  return bySlug.get(slug);
}

export function sitesInCategory(id: string): SiteRecord[] {
  return sites.filter((s) => categoryId(s) === id);
}

/** Featured: the sites the directory itself cross-links the most. */
export const featured: SiteRecord[] = [...sites]
  .sort((a, b) => (b.related?.length ?? 0) - (a.related?.length ?? 0))
  .slice(0, 12);

export const allTags: { tag: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const s of sites) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 18);
})();

export const SITE_COUNT = sites.length;
