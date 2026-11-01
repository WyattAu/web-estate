// new-kit: scaffold a package and register it in estate.yml. This is how
// the estate compounds: every kit is born with a SPEC, a test, tsconfig,
// a registry entry, and an audit-clean state. Usage:
//
//   bun run scripts/new-kit.ts <name> <area> [mirror-crate]
//
// area: one of the estate areas (dx, app, ui, data, ...). mirror-crate:
// optional Rust crate name whose wire semantics this kit shares.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const [name, area, mirror] = process.argv.slice(2);

if (!name || !area) {
  console.error("usage: bun run scripts/new-kit.ts <name> <area> [mirror-crate]");
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error(`invalid kit name: ${name} (kebab-case)`);
  process.exit(2);
}

const dir = join(ROOT, "packages", name);
if (existsSync(dir)) {
  console.error(`packages/${name} already exists`);
  process.exit(2);
}

mkdirSync(join(dir, "src"), { recursive: true });

writeFileSync(
  join(dir, "package.json"),
  `${JSON.stringify(
    {
      name: `@est/${name}`,
      version: "0.1.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
      scripts: { build: "tsc --noEmit", test: "bun test" },
      devDependencies: { "@types/bun": "^1.2.0", typescript: "^5.8.0" },
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(dir, "tsconfig.json"),
  `${JSON.stringify({ extends: "../../tsconfig.base.json", include: ["src", "index.test.ts"] }, null, 2)}\n`,
);

writeFileSync(
  join(dir, "src", "index.ts"),
  `// @est/${name}: TODO describe the kit in one line.\n\nexport const KIT = "${name}";\n`,
);

writeFileSync(
  join(dir, "index.test.ts"),
  `import { describe, expect, test } from "bun:test";
import { KIT } from "./src/index";

describe("@est/${name}", () => {
  test("kit identity", () => {
    expect(KIT).toBe("${name}");
  });
});
`,
);

writeFileSync(
  join(dir, "SPEC.md"),
  `# @est/${name}

DRAFT (tier k, last audit ${new Date().toISOString().slice(0, 10)})

TODO: one paragraph: what this kit does and what it mirrors, if anything.

## Truth table

| Concern | Truth |
|---|---|
| Public API | \`src/index.ts\` |
| Wire semantics (if any) | \`conformance/${name}/cases.json\` |

## Requirements

- REQ-1: TODO first normative statement; pair it with an oracle before
  leaving DRAFT.
`,
);

// Register in estate.yml under packages: and set mirrors if given.
const estatePath = join(ROOT, "estate.yml");
let estate = readFileSync(estatePath, "utf8");
const entry = [
  `  ${name}:`,
  `    npm: "@est/${name}"`,
  `    version: "0.1.0"`,
  `    area: ${area}`,
  `    status: support`,
  ...(mirror ? [`    mirrors: "${mirror}"`] : []),
  `    notes: "Scaffolded by new-kit; replace with a real description."`,
  `    docs:`,
  `      tier: k`,
  `      specs: ["packages/${name}/SPEC.md"]`,
  `      truth_table: "AGENTS.md"`,
  `      llms_txt: true`,
  `      status: draft`,
  `      last_audit: ${new Date().toISOString().slice(0, 10)}`,
].join("\n");

const marker = "packages:\n";
if (!estate.includes(marker)) {
  console.error("estate.yml has no packages: section; add the entry by hand");
  process.exit(2);
}
estate = estate.replace(marker, `${marker}${entry}\n\n`);
writeFileSync(estatePath, estate);

console.log(`@est/${name}: scaffolded, registered in estate.yml`);
console.log(`  next: implement src/index.ts, add fixtures if wire semantics, bun install`);
