// llms-txt: regenerate llms.txt from estate.yml. Projection, not truth;
// never hand-edit. Run: bun run docs:llms

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = new URL("..", import.meta.url).pathname;
const registry = parse(readFileSync(join(ROOT, "estate.yml"), "utf8")) as {
  packages?: Record<
    string,
    { npm: string; version: string; status: string; notes: string; mirrors?: string }
  >;
  consumers?: Record<string, unknown>;
  crates?: Record<string, unknown>;
};

const lines: string[] = [];
lines.push("> WyattAu web-estate: TS + SolidJS + Astro + Starlight kits under Bun,");
lines.push("> with optional custom wasm. Registry of record: estate.yml.");
lines.push("");
lines.push("## Kits");
lines.push("");
for (const [name, p] of Object.entries(registry.packages ?? {})) {
  lines.push(
    `- [${p.npm}](packages/${name}/SPEC.md): ${p.notes} (v${p.version}, ${p.status}${p.mirrors ? `, mirrors ${p.mirrors}` : ""})`,
  );
}
lines.push("");
lines.push("## Consumers");
lines.push("");
for (const name of Object.keys(registry.consumers ?? {})) {
  lines.push(`- ${name}: apps/${name}`);
}
lines.push("");
lines.push("## Crates (wasm)");
lines.push("");
for (const [name, c] of Object.entries(registry.crates ?? {})) {
  const crate = c as { path?: string };
  lines.push(`- ${name}: ${crate.path ?? `crates/${name}`}`);
}
lines.push("");
if (existsSync(join(ROOT, "AGENTS.md"))) {
  lines.push("Read AGENTS.md for the repo contract.");
}

writeFileSync(join(ROOT, "llms.txt"), `${lines.join("\n")}\n`);
console.log(`llms.txt: regenerated (${Object.keys(registry.packages ?? {}).length} kits)`);
