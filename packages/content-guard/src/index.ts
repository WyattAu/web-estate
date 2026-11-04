// @est/content-guard: content validators extracted from the
// starlight-content-guard repo (Validator/ValidationIssue shapes mirrored;
// gray-matter + zod stack). The em-dash validator encodes SPEC-CORE's
// no-em-dash rule for estate Markdown.

import matter from "gray-matter";
import { z } from "zod";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  id: string;
  severity: Severity;
  file: string;
  line?: number;
  message: string;
  validator: string;
  fix?: string;
}

export interface FrontmatterOptions {
  /** Require a non-empty description (default true). */
  requireDescription?: boolean;
  /** Minimum description length (default 20). */
  minDescriptionLength?: number;
}

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

/** Validate YAML frontmatter: title required, description per options. */
export function validateFrontmatter(
  file: string,
  content: string,
  options: FrontmatterOptions = {},
): ValidationIssue[] {
  const requireDescription = options.requireDescription ?? true;
  const minDescriptionLength = options.minDescriptionLength ?? 20;
  const issues: ValidationIssue[] = [];

  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(content);
  } catch (error) {
    issues.push({
      id: `frontmatter-parse-${file}`,
      severity: "error",
      file,
      message: `frontmatter does not parse: ${String(error)}`,
      validator: "frontmatter",
      fix: "repair the YAML frontmatter block",
    });
    return issues;
  }

  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        id: `frontmatter-${issue.path.join(".")}-${file}`,
        severity: "error",
        file,
        message: `frontmatter ${issue.path.join(".")}: ${issue.message}`,
        validator: "frontmatter",
        fix: "add the missing frontmatter field",
      });
    }
    return issues;
  }

  const data = result.data;
  if (requireDescription && !data.description) {
    issues.push({
      id: `frontmatter-description-${file}`,
      severity: "error",
      file,
      message: "description is required",
      validator: "frontmatter",
      fix: "add a description",
    });
  } else if (data.description && data.description.length < minDescriptionLength) {
    issues.push({
      id: `frontmatter-description-short-${file}`,
      severity: "warning",
      file,
      message: `description shorter than ${minDescriptionLength} characters`,
      validator: "frontmatter",
      fix: "lengthen the description",
    });
  }
  return issues;
}

/**
 * SPEC-CORE rule: the em-dash character never appears in estate Markdown.
 * Flags every occurrence with a fix hint (replace with colon, semicolon,
 * or hyphen).
 */
export function validateEmDash(file: string, content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split("\n");
  lines.forEach((line, idx) => {
    const col = line.indexOf("—");
    if (col !== -1) {
      issues.push({
        id: `emdash-${file}-${idx + 1}`,
        severity: "error",
        file,
        line: idx + 1,
        message: "em-dash character found",
        validator: "em-dash",
        fix: "replace with colon, semicolon, or hyphen",
      });
    }
  });
  return issues;
}
