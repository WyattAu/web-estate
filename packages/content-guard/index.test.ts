import { describe, expect, test } from "bun:test";
import cases from "../../conformance/content-guard/cases.json";
import { validateEmDash, validateFrontmatter } from "./src/index";

type Document = { name: string; content: string };
type FrontmatterExpectation = {
  doc: string;
  issues?: string[];
  severity?: string;
  validator?: string;
};
type EmDashExpectation = { doc: string; issues: number };

const suite = cases as unknown as {
  suite: string;
  documents: Document[];
  frontmatter_expectations: FrontmatterExpectation[];
  emdash_expectations: EmDashExpectation[];
};

const byName = new Map(suite.documents.map((d) => [d.name, d.content]));

describe("conformance: content-guard", () => {
  test("fixture suite is content-guard", () => {
    expect(suite.suite).toBe("content-guard");
  });

  for (const expectation of suite.frontmatter_expectations) {
    const content = byName.get(expectation.doc);
    test(`frontmatter: ${expectation.doc}`, () => {
      const issues = validateFrontmatter(expectation.doc, content ?? "", {
        minDescriptionLength: 20,
      });
      const topSeverity = issues.find((i) => i.severity === "error");
      if (expectation.issues && expectation.issues.length === 0) {
        expect(issues).toEqual([]);
        return;
      }
      expect(issues.length).toBeGreaterThan(0);
      if (topSeverity) expect(topSeverity.severity).toBe("error");
      if (expectation.severity === "warning") {
        expect(issues.every((i) => i.severity === "warning")).toBe(true);
      }
      for (const issue of issues) {
        expect(issue.validator).toBe(expectation.validator ?? "frontmatter");
      }
    });
  }

  for (const expectation of suite.emdash_expectations) {
    test(`em-dash: ${expectation.doc} -> ${expectation.issues} issue(s)`, () => {
      const issues = validateEmDash(expectation.doc, byName.get(expectation.doc) ?? "");
      expect(issues.length).toBe(expectation.issues);
      for (const issue of issues) {
        expect(issue.fix).toContain("hyphen");
      }
    });
  }
});
