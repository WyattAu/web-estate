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
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 255;
  if (s.length === 3) {
    if (!/^[0-9a-fA-F]{3}$/.test(s)) throw new InvalidThemeHexError(role, "unparseable value");
    r = parseInt(s[0]! + s[0]!, 16);
    g = parseInt(s[1]! + s[1]!, 16);
    b = parseInt(s[2]! + s[2]!, 16);
  } else if (s.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(s)) throw new InvalidThemeHexError(role, "unparseable value");
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
  } else if (s.length === 8) {
    if (!/^[0-9a-fA-F]{8}$/.test(s)) throw new InvalidThemeHexError(role, "unparseable value");
    r = parseInt(s.slice(0, 2), 16);
    g = parseInt(s.slice(2, 4), 16);
    b = parseInt(s.slice(4, 6), 16);
    a = parseInt(s.slice(6, 8), 16);
  } else {
    throw new InvalidThemeHexError(role, "unparseable value");
  }
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
      return ROLES.filter((r) => map.has(r)).map((role) => ({
        role,
        hex: map.get(role)!,
      }));
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
