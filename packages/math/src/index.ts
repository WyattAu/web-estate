// @est/math: LaTeX/MDX brace handling extracted from the starlight-katex
// remark plugin. The mdast traversal stays in the source repo; this kit
// exposes the pure string semantics: environment names, placeholder
// restore, and the brace-escape decision for MDX text expressions.

export const LATEX_ENV_NAMES: ReadonlySet<string> = new Set([
  "aligned",
  "align",
  "align*",
  "cases",
  "gather",
  "gather*",
  "pmatrix",
  "bmatrix",
  "vmatrix",
  "matrix",
  "array",
  "equation",
  "equation*",
  "split",
  "multline",
  "multline*",
  "flalign",
  "flalign*",
  "eqnarray",
  "eqnarray*",
  "tabular",
  "table",
  "center",
  "displaymath",
  "CD",
]);

export const PLACEHOLDER_LB_CIRCLED = "\u29C3LB\u29C4";
export const PLACEHOLDER_RB_CIRCLED = "\u29C3RB\u29C4";
export const PLACEHOLDER_LB_DIAMOND = "\u25C6LB\u25C6";
export const PLACEHOLDER_RB_DIAMOND = "\u25C6RB\u25C6";
export const PLACEHOLDER_LB_PUA = "\uE000";
export const PLACEHOLDER_RB_PUA = "\uE001";

const PLACEHOLDER_MAP: ReadonlyArray<[RegExp, string]> = [
  [new RegExp(escapeRegex(PLACEHOLDER_LB_CIRCLED), "g"), "{"],
  [new RegExp(escapeRegex(PLACEHOLDER_RB_CIRCLED), "g"), "}"],
  [new RegExp(escapeRegex(PLACEHOLDER_LB_PUA), "g"), "{"],
  [new RegExp(escapeRegex(PLACEHOLDER_RB_PUA), "g"), "}"],
  [new RegExp(escapeRegex(PLACEHOLDER_LB_DIAMOND), "g"), "{"],
  [new RegExp(escapeRegex(PLACEHOLDER_RB_DIAMOND), "g"), "}"],
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Restore all known placeholder sequences back to literal braces. */
export function restorePlaceholders(str: string): string {
  let result = str;
  for (const [pattern, replacement] of PLACEHOLDER_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Is this MDX text-expression body a known LaTeX environment name? */
export function isLatexEnvironment(expr: string): boolean {
  return LATEX_ENV_NAMES.has(expr.trim());
}

/**
 * The MDX brace decision for one text-expression body (mirrors the
 * remark plugin): known LaTeX environment -> restore raw {expr};
 * anything else -> escape to \{expr\} so KaTeX sees literal braces.
 */
export function escapeMdxTextExpression(expr: string): string {
  return isLatexEnvironment(expr.trim()) ? `{${expr}}` : `\\{${expr}\\}`;
}

/** Escape unescaped curly braces in a plain string (KaTeX literal braces). */
export function escapeLiteralBraces(str: string): string {
  return str.replace(/([{}])/g, "\\$1");
}
