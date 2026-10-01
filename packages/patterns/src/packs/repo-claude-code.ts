import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const CLAUDE_COAUTHOR =
  /co-authored-by:\s*claude(?:\s*<[^>]+>)?/i;
const CLAUDE_CODE_FOOTER =
  /generated\s+with\s+\[?claude\s*code\]?|claude\.ai\/code|🤖\s*generated\s+with\s+claude/i;

export const repoClaudeCodePatterns: PatternDefinition[] = [
  {
    id: "claude-code.co-authored",
    tool: "claude_code",
    tier: "S0",
    humanLabel: "Co-Authored-By: Claude in git",
    surfaces: ["git_meta"],
    why: "Claude Code adds Co-Authored-By: Claude trailers to commits and PRs.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        const blob = `${c.message}\n${(c.coAuthors ?? []).join("\n")}`;
        const m = blob.match(CLAUDE_COAUTHOR);
        if (m) return clip(m[0]);
      }
      if (input.prBody) {
        const m = input.prBody.match(CLAUDE_COAUTHOR);
        if (m) return clip(m[0]);
      }
      return null;
    },
  },
  {
    id: "claude-code.footer",
    tool: "claude_code",
    tier: "S0",
    humanLabel: "Claude Code PR/commit footer",
    surfaces: ["git_meta"],
    why: "Claude Code often appends a Generated with Claude Code footer.",
    match: (input) => {
      for (const c of input.commits ?? []) {
        if (CLAUDE_CODE_FOOTER.test(c.message)) return clip(c.message);
      }
      if (input.prBody && CLAUDE_CODE_FOOTER.test(input.prBody)) {
        return clip(input.prBody);
      }
      return null;
    },
  },
];
