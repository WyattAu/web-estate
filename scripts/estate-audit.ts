// estate-audit: verify estate.yml against package.json files, Cargo.toml
// versions, and consumer pins. Fails when they disagree. Exit 0 = green.
//
//   bun run scripts/estate-audit.ts
//
// Checks:
//   1. every packages/*/package.json is registered, versions match
//   2. statuses use the registry vocabulary
//   3. core packages have at least one exact consumer pin
//   4. consumer pins match package versions (drift fails)
//   5. mirror packages have their conformance fixture file
//   6. crates/*/Cargo.toml versions match the registry; a registered
//      npm wrapper's version equals the crate version (version-lock)
//   7. llms.txt exists and lists every package

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = new URL("..", import.meta.url).pathname;
const STATUSES = new Set(["core", "support", "orphan", "dormant", "template"]);

type Findings = string[];
const fail = (f: Findings, msg: string) => f.push(msg);

const registryPath = join(ROOT, "estate.yml");
const registry = parse(readFileSync(registryPath, "utf8")) as {
  packages?: Record<string, { npm: string; version: string; status: string; mirrors?: string }>;
  consumers?: Record<string, { path: string; pins: Record<string, string> }>;
  crates?: Record<string, { path: string; version: string; wrapper: string | null }>;
};

const findings: Findings = [];
const pkgVersions = new Map<string, string>(); // npm name -> version

// 1+2: packages on disk vs registry
const pkgDir = join(ROOT, "packages");
for (const dir of existsSync(pkgDir) ? readdirSync(pkgDir) : []) {
  const pjPath = join(pkgDir, dir, "package.json");
  if (!existsSync(pjPath)) continue;
  const pj = JSON.parse(readFileSync(pjPath, "utf8")) as { name: string; version: string };
  const entry = registry.packages?.[dir];
  if (!entry) {
    fail(findings, `${pj.name}: not registered in estate.yml (run scripts/new-kit.ts)`);
    continue;
  }
  if (entry.npm !== pj.name)
    fail(findings, `${dir}: registry npm ${entry.npm} != package.json ${pj.name}`);
  if (entry.version !== pj.version) {
    fail(findings, `${dir}: registry version ${entry.version} != package.json ${pj.version}`);
  }
  if (!STATUSES.has(entry.status)) {
    fail(findings, `${dir}: unknown status "${entry.status}"`);
  }
  pkgVersions.set(pj.name, pj.version);
}

for (const [name, entry] of Object.entries(registry.packages ?? {})) {
  if (!existsSync(join(pkgDir, name)))
    fail(findings, `${entry.npm}: registered but packages/${name} missing`);
  // 5: fixtures live under a suite dir; a package owns conformance/<name>/
  // or shares the suite named by `mirrors` (the wasm-twin case).
  if (entry.mirrors) {
    const own = join(ROOT, "conformance", name, "cases.json");
    const shared = join(ROOT, "conformance", entry.mirrors, "cases.json");
    if (!existsSync(own) && !existsSync(shared)) {
      fail(
        findings,
        `${entry.npm}: mirrors ${entry.mirrors} but no conformance/${name}/ or conformance/${entry.mirrors}/cases.json`,
      );
    }
  }
}

// 3+4: consumer pins
for (const [consumer, c] of Object.entries(registry.consumers ?? {})) {
  if (!existsSync(join(ROOT, c.path)))
    fail(findings, `consumer ${consumer}: path ${c.path} missing`);
  for (const [npm, pin] of Object.entries(c.pins ?? {})) {
    const actual = pkgVersions.get(npm);
    if (actual === undefined) {
      fail(findings, `consumer ${consumer}: pins ${npm} but package not found`);
    } else if (actual !== pin) {
      fail(findings, `consumer ${consumer}: pins ${npm}@${pin} but package is ${actual}`);
    }
  }
}
for (const [_name, entry] of Object.entries(registry.packages ?? {})) {
  if (entry.status !== "core") continue;
  const pinned = Object.values(registry.consumers ?? {}).some(
    (c) => c.pins?.[entry.npm] === entry.version,
  );
  if (!pinned) {
    fail(findings, `${entry.npm}: claims core but no consumer pins it exactly (core is earned)`);
  }
}

// 6: crates + version-lock
for (const [name, crate] of Object.entries(registry.crates ?? {})) {
  const tomlPath = join(ROOT, crate.path, "Cargo.toml");
  if (!existsSync(tomlPath)) {
    fail(findings, `crate ${name}: ${crate.path}/Cargo.toml missing`);
    continue;
  }
  const toml = readFileSync(tomlPath, "utf8");
  const m = /^version\s*=\s*"([^"]+)"/m.exec(toml);
  if (!m || m[1] !== crate.version) {
    fail(
      findings,
      `crate ${name}: registry version ${crate.version} != Cargo.toml ${m?.[1] ?? "missing"}`,
    );
  }
  if (crate.wrapper) {
    const w = pkgVersions.get(crate.wrapper);
    if (w === undefined) {
      fail(findings, `crate ${name}: wrapper ${crate.wrapper} not found in packages/`);
    } else if (w !== m?.[1]) {
      fail(findings, `version-lock: crate ${name}@${m[1]} != wrapper ${crate.wrapper}@${w}`);
    }
  }
}

// 7: llms.txt projection freshness
const llms = join(ROOT, "llms.txt");
if (!existsSync(llms)) {
  fail(findings, "llms.txt missing (run: bun run docs:llms)");
} else {
  const text = readFileSync(llms, "utf8");
  for (const entry of Object.values(registry.packages ?? {})) {
    if (!text.includes(entry.npm)) fail(findings, `llms.txt: missing ${entry.npm}`);
  }
}

if (findings.length > 0) {
  console.error(`estate-audit: ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(
  `estate-audit: green (${Object.keys(registry.packages ?? {}).length} packages, ` +
    `${Object.keys(registry.consumers ?? {}).length} consumers, ` +
    `${Object.keys(registry.crates ?? {}).length} crates)`,
);
