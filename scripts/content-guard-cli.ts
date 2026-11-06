// Generic content-guard CLI: walk a directory of .md/.mdx files and run
// the kit's validators. Exit 1 when errors are found (warnings report).
// Designed for cross-repo adoption: CI checks out this repo next to the
// target and runs this script against the target's content directory.
//
// Usage:
//   bun run scripts/content-guard-cli.ts <dir> [options]
// Options:
//   --min-description <N>     minimum description length (default 20)
//   --no-require-description  description becomes optional
//   --no-emdash               skip the em-dash validator
//   --exclude <substr>        skip files whose path contains the substring
//                             (repeatable)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { validateEmDash, validateFrontmatter } from "@est/content-guard";

interface CliOptions {
  minDescriptionLength: number;
  requireDescription: boolean;
  emdash: boolean;
  exclude: string[];
}

function parseArgs(argv: string[]): { dir: string; options: CliOptions } {
  const dir = argv[0];
  if (!dir) {
    console.error("usage: bun run scripts/content-guard-cli.ts <dir> [options]");
    process.exit(2);
  }
  const options: CliOptions = {
    minDescriptionLength: 20,
    requireDescription: true,
    emdash: true,
    exclude: [],
  };
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--min-description") {
      options.minDescriptionLength = Number(rest[++i]);
    } else if (arg === "--no-require-description") {
      options.requireDescription = false;
    } else if (arg === "--no-emdash") {
      options.emdash = false;
    } else if (arg === "--exclude") {
      options.exclude.push(rest[++i] ?? "");
    }
  }
  return { dir, options };
}

function walk(dir: string, exclude: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      out.push(...walk(p, exclude));
    } else if (entry.endsWith(".md") || entry.endsWith(".mdx")) {
      if (!exclude.some((substr) => p.includes(substr))) out.push(p);
    }
  }
  return out;
}

const { dir, options } = parseArgs(process.argv.slice(2));

const files: string[] = [];
try {
  files.push(...walk(dir, options.exclude));
} catch {
  console.error(`content-guard: cannot read directory ${dir}`);
  process.exit(2);
}
if (files.length === 0) {
  console.error(`content-guard: no .md/.mdx files under ${dir}`);
  process.exit(2);
}

let errors = 0;
let warnings = 0;

for (const file of files) {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const rel = relative(process.cwd(), file);
  if (options.requireDescription) {
    // description requirement is a frontmatter-option, re-validate per doc
  }
  const issues = [
    ...(options.requireDescription
      ? validateFrontmatter(file, content, {
          requireDescription: true,
          minDescriptionLength: options.minDescriptionLength,
        })
      : validateFrontmatter(file, content, {
          requireDescription: false,
          minDescriptionLength: options.minDescriptionLength,
        })),
    ...(options.emdash ? validateEmDash(file, content) : []),
  ];
  for (const issue of issues) {
    if (issue.severity === "error") errors++;
    else warnings++;
    const loc = issue.line !== undefined ? `:${issue.line}` : "";
    console.error(
      `${issue.severity.toUpperCase()} ${rel}${loc} [${issue.validator}] ${issue.message}`,
    );
  }
}

console.log(`content-guard: ${files.length} files, ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
