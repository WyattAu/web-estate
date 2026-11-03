// @est/i18n: TS mirror of the i18n-kit crate.
// Wire truth: conformance/i18n/cases.json (locale normalization, plural
// suffixes, translator fallback chain, interpolation semantics).

export class InvalidLocaleError extends Error {
  constructor(reason: string) {
    super(`invalid locale: ${reason}`);
    this.name = "InvalidLocaleError";
  }
}

/**
 * Normalize a BCP 47 tag the way i18n-kit::Locale::normalize does:
 * language lowercase, 4-letter subtags Titlecase, 2-letter or all-digit
 * subtags uppercase, anything else unchanged. Throws on tags the Rust
 * parser rejects (empty, >35 chars, non-ASCII alphanumeric, language
 * subtag not 2-3 lowercase letters).
 */
export function normalizeLocale(tag: string): string {
  const trimmed = tag.trim();
  if (trimmed.length === 0) throw new InvalidLocaleError("empty locale tag");
  if (trimmed.length > 35) throw new InvalidLocaleError(`locale tag exceeds 35 chars: ${trimmed}`);
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    throw new InvalidLocaleError(`locale tag contains invalid characters: ${trimmed}`);
  }
  const parts = trimmed.split("-");
  const out: string[] = parts.map((part, i) => {
    if (i === 0) return part.toLowerCase();
    if (part.length === 4) return part[0]?.toUpperCase() + part.slice(1).toLowerCase();
    if (part.length === 2 || /^\d+$/.test(part)) return part.toUpperCase();
    return part;
  });
  const normalized = out.join("-");
  const lang = normalized.split("-")[0] ?? "";
  if (lang.length < 2 || lang.length > 3 || !/^[a-z]+$/.test(lang)) {
    throw new InvalidLocaleError(`invalid language subtag: ${lang}`);
  }
  return normalized;
}

/** Primary subtag (the language). Caller guarantees a valid tag. */
export function localeLanguage(tag: string): string {
  return normalizeLocale(tag).split("-")[0] ?? "";
}

export type PluralSuffix = "zero" | "one" | "other";

/** English-style: 1 = one, everything else = other. */
export function pluralForCount(count: number): PluralSuffix {
  return count === 1 ? "one" : "other";
}

/** English-style with explicit zero handling. */
export function pluralWithZero(count: number): PluralSuffix {
  return count === 0 ? "zero" : pluralForCount(count);
}

export interface CatalogShape {
  insert(locale: string, key: string, value: string): void;
  insertBulk(locale: string, translations: Record<string, string>): void;
  get(locale: string, key: string): string | undefined;
  locales(): string[];
  keyCount(locale: string): number;
}

/** locale -> key -> value. Keys are dot notation; later inserts overwrite. */
export function createCatalog(): CatalogShape {
  const entries = new Map<string, Map<string, string>>();
  return {
    insert(locale, key, value) {
      const loc = normalizeLocale(locale);
      let keys = entries.get(loc);
      if (!keys) {
        keys = new Map();
        entries.set(loc, keys);
      }
      keys.set(key, value);
    },
    insertBulk(locale, translations) {
      for (const [key, value] of Object.entries(translations)) {
        this.insert(locale, key, value);
      }
    },
    get(locale, key) {
      return entries.get(normalizeLocale(locale))?.get(key);
    },
    locales() {
      return [...entries.keys()];
    },
    keyCount(locale) {
      return entries.get(normalizeLocale(locale))?.size ?? 0;
    },
  };
}

export type TranslateParams = Record<string, string>;

/**
 * Replace {name} slots with params. An unmatched well-formed slot becomes
 * the EMPTY string (mirrors the Rust interpolate); a brace with no closing
 * brace stays literal.
 */
export function interpolate(template: string, params: TranslateParams): string {
  let out = "";
  let rest = template;
  for (;;) {
    const start = rest.indexOf("{");
    if (start === -1) break;
    out += rest.slice(0, start);
    const after = rest.slice(start + 1);
    const end = after.indexOf("}");
    if (end === -1) {
      out += "{";
      rest = after;
    } else {
      const name = after.slice(0, end);
      out += params[name] ?? "";
      rest = after.slice(end + 1);
    }
  }
  return out + rest;
}

export interface Translator {
  translate(locale: string, key: string, params?: TranslateParams): string;
  translatePlural(locale: string, keyBase: string, count: number, params?: TranslateParams): string;
  exists(locale: string, key: string): boolean;
}

/**
 * Fallback chain, mirrored from i18n-kit::Translator::translate:
 * 1. exact locale
 * 2. the locale's primary language subtag
 * 3. the default locale, but only when its language differs (step 2
 *    already covered same-language defaults)
 * 4. the key itself
 */
export function createTranslator(catalog: CatalogShape, defaultLocale: string): Translator {
  const def = normalizeLocale(defaultLocale);
  const defLang = def.split("-")[0] ?? "";

  function lookup(locale: string, key: string): string | undefined {
    return catalog.get(locale, key);
  }

  function translate(locale: string, key: string, params: TranslateParams = {}): string {
    const loc = normalizeLocale(locale);
    const lang = loc.split("-")[0] ?? "";
    const exact = lookup(loc, key);
    if (exact !== undefined) return interpolate(exact, params);
    const byLanguage = lookup(lang, key);
    if (byLanguage !== undefined) return interpolate(byLanguage, params);
    if (loc !== def && lang !== defLang) {
      const byDefault = lookup(def, key);
      if (byDefault !== undefined) return interpolate(byDefault, params);
    }
    return key;
  }

  return {
    translate,
    translatePlural(locale, keyBase, count, params = {}) {
      const suffix = pluralWithZero(count);
      const all: TranslateParams = { ...params, count: String(count) };
      return translate(locale, `${keyBase}.${suffix}`, all);
    },
    exists(locale, key) {
      const loc = normalizeLocale(locale);
      const lang = loc.split("-")[0] ?? "";
      return (
        lookup(loc, key) !== undefined ||
        lookup(lang, key) !== undefined ||
        lookup(def, key) !== undefined
      );
    },
  };
}

/** Build a catalog from a literal locale->keys object and its translator. */
export function createI18n(
  data: Record<string, Record<string, string>>,
  defaultLocale: string,
): Translator & { catalog: CatalogShape } {
  const catalog = createCatalog();
  for (const [locale, translations] of Object.entries(data)) {
    catalog.insertBulk(locale, translations);
  }
  return { catalog, ...createTranslator(catalog, defaultLocale) };
}
