// The docs gate: @est/content-guard validating every MDX page in this
// app. Errors fail the build; warnings report. This is the kit's first
// consumer (content-guard graduation path).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateEmDash, validateFrontmatter } from "@est/content-guard";

const contentDir = join(import.meta.dir, "..", "src", "content", "docs");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".mdx") || entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = existsSync(contentDir) ? walk(contentDir) : [];
let errors = 0;
let warnings = 0;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const issue of [
    ...validateFrontmatter(file, content, {
      requireDescription: true,
      minDescriptionLength: 20,
    }),
    ...validateEmDash(file, content),
  ]) {
    if (issue.severity === "error") errors++;
    else warnings++;
    console.error(
      `  ${issue.severity.toUpperCase()} ${issue.file}:${issue.line ?? "?"} ${issue.message}`,
    );
  }
}

console.log(`docs gate: ${files.length} pages, ${errors} errors, ${warnings} warnings`);
if (errors > 0) process.exit(1);
