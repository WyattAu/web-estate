// @est/theme: TS mirror of the theme-kit crate (0.1.1): the token graph
// (role -> hex), BCP-safe hex normalization, the CSS vars emitter, and
// DTCG JSON output. Golden fixtures were generated from the published
// crate itself (theme-dump against theme-kit 0.1.1).

/** The 12 roles in declaration order (REQ-THM-009 determinism). */
export const ROLES = [
  "surface",
  "surface-raised",
  "on-surface",
  "on-surface-muted",
  "accent",
  "on-accent",
  "warn",
  "error",
  "success",
  "selection",
  "border",
  "focus-ring",
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Normalize a hex color to the crate's canonical form: lowercase
 * #rrggbb, or #rrggbbaa when alpha != 255. Accepts #rgb, #rrggbb,
 * #rrggbbaa (leading # optional). Malformed input throws ThemeError.
 */
export class InvalidThemeHexError extends Error {
  readonly role: string;
  constructor(role: string, reason: string) {
    super(`${role}: ${reason}`);
    this.name = "InvalidThemeHexError";
    this.role = role;
  }
}

export function normalizeHex(role: Role, hex: string): string {
  let s = hex.trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (s.length === 3) s = [...s].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s) && !/^[0-9a-fA-F]{8}$/.test(s)) {
    throw new InvalidThemeHexError(role, "unparseable value");
  }
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255;
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a === 255 ? base : `${base}${hex2(a)}`;
}

function hex2(v: number): string {
  return v.toString(16).padStart(2, "0");
}

export interface TokenGraph {
  name: string;
  setHex(role: Role, hex: string): void;
  resolve(role: Role): string | undefined;
  require(role: Role): string;
  roles(): { role: Role; hex: string }[];
  toCssVars(): string;
  toDtcgJson(): string;
}

/** The estate-light palette: the dogfood palette used by the deployed
 * directory and ledger surfaces. Golden-fixture source (conformance/theme). */
export const ESTATE_LIGHT: Readonly<Record<Role, string>> = {
  surface: "#faf9f5",
  "surface-raised": "#ffffff",
  "on-surface": "#1c1c1a",
  "on-surface-muted": "#6f6d66",
  accent: "#3b6ef5",
  "on-accent": "#ffffff",
  warn: "#b45309",
  error: "#c62828",
  success: "#2e7d32",
  selection: "#dbeafe",
  border: "#e4e1d6",
  "focus-ring": "#93c5fd",
};

/** Build the estate-light graph in one call. */
export function estateLightGraph(): TokenGraph {
  const graph = createTokenGraph("estate-light");
  for (const [role, hex] of Object.entries(ESTATE_LIGHT)) {
    graph.setHex(role as Role, hex);
  }
  return graph;
}

/** role -> hex graph; roles() emits in declaration order (THM-009). */
export function createTokenGraph(name: string): TokenGraph {
  const map = new Map<Role, string>();
  const graph: TokenGraph = {
    name,
    setHex(role, hex) {
      map.set(role, normalizeHex(role, hex));
    },
    resolve(role) {
      return map.get(role);
    },
    require(role) {
      const hex = map.get(role);
      if (hex === undefined) throw new InvalidThemeHexError(role, "missing role");
      return hex;
    },
    roles() {
      // Declaration order, present roles only (mirrors the crate's roles()
      // iteration over Role::ALL).
      const out: { role: Role; hex: string }[] = [];
      for (const role of ROLES) {
        const hex = map.get(role);
        if (hex !== undefined) out.push({ role, hex });
      }
      return out;
    },
    toCssVars() {
      let out = ":root {\n";
      for (const { role, hex } of graph.roles()) {
        out += `  --color-${role}: ${hex};\n`;
      }
      return `${out}}\n`;
    },
    toDtcgJson() {
      // DTCG is alphabetical by token name (BTreeMap order in the crate).
      const color: Record<string, unknown> = {};
      for (const role of [...ROLES].sort()) {
        const hex = map.get(role);
        if (hex !== undefined) {
          color[role] = { $type: "color", $value: hex };
        }
      }
      return `${JSON.stringify(
        {
          $description: name,
          $schema: "https://tr.designtokens.org/format/",
          color,
        },
        null,
        2,
      )}\n`;
    },
  };
  return graph;
}
