import type { PatternDefinition } from "../types.js";

function hasFile(files: string[] | undefined, predicate: (p: string) => boolean): string | null {
  if (!files) return null;
  for (const f of files) {
    const norm = f.replace(/\\/g, "/");
    if (predicate(norm)) return norm;
  }
  return null;
}

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const CURSOR_COAUTHOR =
  /co-authored-by:\s*cursor(?:\s*<[^>]*>)?/i;
const CURSOR_AGENT_EMAIL = /cursoragent@cursor\.com/i;

export const repoCursorPatterns: PatternDefinition[] = [
  {
    id: "cursor.co-authored",
    tool: "cursor",
    tier: "S0",
    humanLabel: "Co-authored-by: Cursor in git",
    surfaces: ["git_meta"],
    why: "Cursor Agent appends Co-authored-by: Cursor <cursoragent@cursor.com> to commits it helps write. Seen on real projects like AlgoVortex.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        const blob = `${c.message}\n${(c.coAuthors ?? []).join("\n")}`;
        const m = blob.match(CURSOR_COAUTHOR) ?? blob.match(CURSOR_AGENT_EMAIL);
        if (m) return clip(m[0]);
      }
      if (input.prBody) {
        const m =
          input.prBody.match(CURSOR_COAUTHOR) ??
          input.prBody.match(CURSOR_AGENT_EMAIL);
        if (m) return clip(m[0]);
      }
      return null;
    },
  },
  {
    id: "cursor.cursorrules",
    tool: "cursor",
    tier: "S2",
    humanLabel: "Legacy .cursorrules file",
    surfaces: ["repo_tree"],
    why: "Cursor projects often ship a root .cursorrules file.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)\.cursorrules$/i.test(p)),
  },
  {
    id: "cursor.rules-mdc",
    tool: "cursor",
    tier: "S2",
    humanLabel: "Cursor rules under .cursor/rules",
    surfaces: ["repo_tree"],
    why: "Modern Cursor stores project rules as .mdc files under .cursor/rules/.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)\.cursor\/rules\/.+\.mdc$/i.test(p)),
  },
  {
    id: "cursor.dir",
    tool: "cursor",
    tier: "S2",
    humanLabel: ".cursor directory present",
    surfaces: ["repo_tree"],
    why: "A .cursor/ folder usually means Cursor was used on the project.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)\.cursor(\/|$)/i.test(p)),
  },
  {
    id: "cursor.agents-skills",
    tool: "cursor",
    tier: "S2",
    humanLabel: "Cursor Agent skills under .agents/skills",
    surfaces: ["repo_tree"],
    why: "Cursor Agent Skills install into .agents/skills/. AlgoVortex ships this layout.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)\.agents\/skills(\/|$)/i.test(p)),
  },
  {
    id: "cursor.skills-lock",
    tool: "cursor",
    tier: "S2",
    humanLabel: "skills-lock.json present",
    surfaces: ["repo_tree"],
    why: "Cursor skill installs write skills-lock.json with source hashes.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)skills-lock\.json$/i.test(p)),
  },
  {
    id: "cursor.agents-md",
    tool: "cursor",
    tier: "S2",
    humanLabel: "AGENTS.md project instructions",
    surfaces: ["repo_tree"],
    why: "Many Cursor/agent workflows use a root AGENTS.md for project instructions.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)AGENTS\.md$/i.test(p)),
  },
  {
    id: "cursor.cursorignore",
    tool: "cursor",
    tier: "S2",
    humanLabel: ".cursorignore present",
    surfaces: ["repo_tree"],
    why: ".cursorignore is Cursor-specific indexing ignore, like .gitignore.",
    match: (input) =>
      hasFile(input.repoFiles, (p) => /(^|\/)\.cursorignore$/i.test(p)),
  },
];
