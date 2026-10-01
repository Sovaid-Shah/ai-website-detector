import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const repoCopilotPatterns: PatternDefinition[] = [
  {
    id: "copilot.bot-author",
    tool: "copilot",
    tier: "S2",
    humanLabel: "GitHub Copilot bot as commit author",
    surfaces: ["git_meta"],
    why: "Copilot coding agent commits often use a Copilot / github-copilot[bot] author.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        if (/copilot|github-copilot\[bot\]/i.test(c.author)) {
          return clip(c.author);
        }
      }
      return null;
    },
  },
  {
    id: "copilot.co-authored",
    tool: "copilot",
    tier: "S2",
    humanLabel: "Co-Authored-By Copilot",
    surfaces: ["git_meta"],
    why: "Some Copilot flows add Co-Authored-By: Copilot trailers.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        const blob = `${c.message}\n${(c.coAuthors ?? []).join("\n")}`;
        const m = blob.match(/co-authored-by:\s*.*copilot.*/i);
        if (m) return clip(m[0]);
      }
      if (input.prBody) {
        const m = input.prBody.match(/co-authored-by:\s*.*copilot.*/i);
        if (m) return clip(m[0]);
      }
      return null;
    },
  },
  {
    id: "copilot.pr-label",
    tool: "copilot",
    tier: "S2",
    humanLabel: "Copilot PR label",
    surfaces: ["git_meta"],
    why: "PRs from Copilot agent may be labeled copilot.",
    match: (input) => {
      const hit = (input.labels ?? []).find((l) => /copilot/i.test(l));
      return hit ? clip(hit) : null;
    },
  },
];
