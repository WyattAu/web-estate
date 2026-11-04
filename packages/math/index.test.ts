import { describe, expect, test } from "bun:test";
import {
  escapeLiteralBraces,
  escapeMdxTextExpression,
  isLatexEnvironment,
  LATEX_ENV_NAMES,
  restorePlaceholders,
} from "./src/index";

describe("math (brace handling)", () => {
  test("environment names include the LaTeX set", () => {
    expect(isLatexEnvironment("aligned")).toBe(true);
    expect(isLatexEnvironment("pmatrix")).toBe(true);
    expect(isLatexEnvironment("unknownenv")).toBe(false);
    expect(LATEX_ENV_NAMES.size).toBeGreaterThan(20);
  });

  test("MDX text expression decision", () => {
    expect(escapeMdxTextExpression("aligned")).toBe("{aligned}");
    expect(escapeMdxTextExpression("x")).toBe("\\{x\\}");
    expect(escapeMdxTextExpression(" cases ")).toBe("{ cases }");
  });

  test("literal braces are escaped for KaTeX", () => {
    expect(escapeLiteralBraces("{x}")).toBe("\\{x\\}");
    expect(escapeLiteralBraces("no braces")).toBe("no braces");
  });

  test("placeholders restore to literal braces", () => {
    expect(restorePlaceholders("\uE000count\uE001")).toBe("{count}");
    expect(restorePlaceholders("\u25C6LB\u25C6x\u25C6RB\u25C6")).toBe("{x}");
    expect(restorePlaceholders("clean")).toBe("clean");
  });
});
