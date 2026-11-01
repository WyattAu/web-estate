// check-conformance: fixture integrity. Every suite file must parse, carry
// a suite name matching its directory, wire version 1, and unique case
// identities. Language tests consume the same files; this guards the
// shared truth itself.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const confDir = join(ROOT, "conformance");

const findings: string[] = [];
let suites = 0;
let cases = 0;

for (const dir of existsSync(confDir) ? readdirSync(confDir) : []) {
  const path = join(confDir, dir, "cases.json");
  if (!existsSync(path)) {
    findings.push(`${dir}: no cases.json`);
    continue;
  }
  let data: { suite?: string; wire?: number; cases?: unknown[] };
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    findings.push(`${dir}: cases.json does not parse (${e})`);
    continue;
  }
  if (data.suite !== dir) findings.push(`${dir}: suite name "${data.suite}" != directory "${dir}"`);
  if (data.wire !== 1) findings.push(`${dir}: unsupported wire version ${data.wire}`);
  if (!Array.isArray(data.cases) || data.cases.length === 0) {
    findings.push(`${dir}: cases empty`);
    continue;
  }
  const ids = data.cases.map((c, i) => JSON.stringify(c));
  const dupes = ids.length - new Set(ids).size;
  if (dupes > 0) findings.push(`${dir}: ${dupes} duplicate case(s)`);
  suites++;
  cases += data.cases.length;
}

if (suites === 0) findings.push("conformance/: no suites found");

if (findings.length > 0) {
  console.error(`check-conformance: ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`check-conformance: green (${suites} suites, ${cases} cases)`);
