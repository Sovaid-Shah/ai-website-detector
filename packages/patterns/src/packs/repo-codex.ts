import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const repoCodexPatterns: PatternDefinition[] = [
  {
    id: "codex.branch",
    tool: "codex",
    tier: "S2",
    humanLabel: "Codex-style branch name",
    surfaces: ["git_meta"],
    why: "OpenAI Codex often opens branches named like codex/…",
    match: (input) => {
      const hit = (input.branches ?? []).find((b) =>
        /^codex(\/|$)/i.test(b.trim()),
      );
      return hit ? clip(hit) : null;
    },
  },
  {
    id: "codex.pr-label",
    tool: "codex",
    tier: "S2",
    humanLabel: "Codex PR label",
    surfaces: ["git_meta"],
    why: "PRs opened by Codex may carry a codex label.",
    match: (input) => {
      const hit = (input.labels ?? []).find((l) => /codex/i.test(l));
      return hit ? clip(hit) : null;
    },
  },
  {
    id: "codex.commit-or-pr",
    tool: "codex",
    tier: "S2",
    humanLabel: "Codex mention in commit/PR text",
    surfaces: ["git_meta"],
    why: "Commit messages or PR bodies sometimes mention Codex / openai-codex.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        const blob = `${c.message}\n${c.author}\n${(c.coAuthors ?? []).join("\n")}`;
        if (/\bcodex\b|openai[- ]codex/i.test(blob)) return clip(c.message || c.author);
      }
      if (input.prBody && /\bcodex\b|openai[- ]codex/i.test(input.prBody)) {
        return clip(input.prBody);
      }
      return null;
    },
  },
];
