#!/usr/bin/env node
/**
 * Offline verify: parse target URL, confirm clone remote, run patterns on real tree/commits.
 * Usage: node scripts/verify-algovortex-github.mjs [/path/to/clone]
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const patternsRoot = join(
  new URL("..", import.meta.url).pathname,
  "packages/patterns/dist",
);

const {
  parseGithubRepoUrl,
  githubNamesMatch,
  runPatternSurfaces,
} = await import(join(patternsRoot, "index.js"));

const EXPECTED = "umarhayatdeveloper24/algovortex";
const INPUTS = [
  "https://github.com/umarhayatdeveloper24/algovortex",
  "git@github.com:umarhayatdeveloper24/algovortex.git",
  "umarhayatdeveloper24/algovortex",
];

const clone =
  process.argv[2] ||
  "/tmp/algovortex-verify";

function walkFiles(root, base = "", out = []) {
  const dir = join(root, base);
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const rel = base ? `${base}/${name}` : name;
    const full = join(root, rel);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(root, rel, out);
    else out.push(rel);
  }
  return out;
}

console.log("=== URL parse check ===");
for (const input of INPUTS) {
  const parsed = parseGithubRepoUrl(input);
  if (!parsed) throw new Error(`parse failed: ${input}`);
  const full = `${parsed.owner}/${parsed.repo}`;
  const ok = githubNamesMatch(parsed, EXPECTED);
  console.log(`${ok ? "OK" : "FAIL"} ${input} -> ${full}`);
  if (!ok) process.exit(1);
}

if (!existsSync(clone)) {
  console.error(`Clone missing at ${clone}. Clone first with SSH.`);
  process.exit(2);
}

const remote = execSync("git remote get-url origin", {
  cwd: clone,
  encoding: "utf8",
}).trim();
const remoteParsed = parseGithubRepoUrl(remote);
console.log("\n=== Clone remote check ===");
console.log(`remote: ${remote}`);
if (!remoteParsed || !githubNamesMatch(remoteParsed, EXPECTED)) {
  console.error(`Clone remote is not ${EXPECTED}`);
  process.exit(1);
}
console.log(`OK clone points at ${EXPECTED}`);

const head = execSync("git rev-parse HEAD", {
  cwd: clone,
  encoding: "utf8",
}).trim();
const repoFiles = walkFiles(clone);
const log = execSync("git log -40 --format=%B%x1e", {
  cwd: clone,
  encoding: "utf8",
});
const commits = log
  .split("\x1e")
  .map((m) => m.trim())
  .filter(Boolean)
  .map((message) => ({
    message,
    author: "local",
    coAuthors: [...message.matchAll(/^co-authored-by:\s*(.+)$/gim)].map(
      (m) => m[1].trim(),
    ),
  }));

const report = runPatternSurfaces(
  {
    url: `https://github.com/${EXPECTED}`,
    repoFiles,
    commits,
    branches: ["main"],
  },
  ["repo_tree", "git_meta"],
);

console.log("\n=== Pattern hits ===");
console.log(`HEAD ${head}`);
console.log(report.summary);
for (const m of report.matches) {
  console.log(`- [${m.tier}] ${m.id}: ${m.evidence}`);
}

const need = [
  "cursor.co-authored",
  "cursor.skills-lock",
  "cursor.agents-skills",
];
const missing = need.filter((id) => !report.matches.some((m) => m.id === id));
if (missing.length) {
  console.error(`Missing expected matches: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("\nVERIFIED correct GitHub target + Cursor patterns.");
