import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const claudePastePatterns: PatternDefinition[] = [
  {
    id: "claude.class.font-response-body",
    tool: "claude",
    tier: "S0",
    humanLabel: "Claude chat UI class in HTML",
    surfaces: ["live_html", "paste_html"],
    why: "Claude’s web UI wraps responses in classes like font-claude-response-body. That class only appears if rich HTML was pasted or left in the page.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(
        /class\s*=\s*["'][^"']*font-claude-response-body[^"']*["']/i,
      );
      return m ? clip(m[0]) : null;
    },
  },
  {
    id: "claude.class.any",
    tool: "claude",
    tier: "S0",
    humanLabel: "HTML class name contains claude",
    surfaces: ["live_html", "paste_html"],
    why: "Chat paste from Claude often carries class attributes containing the word claude.",
    match: (input) => {
      const html = input.html ?? "";
      // Avoid double-counting the specific class above when present
      if (/font-claude-response-body/i.test(html)) return null;
      const m = html.match(/class\s*=\s*["'][^"']*claude[^"']*["']/i);
      return m ? clip(m[0]) : null;
    },
  },
  {
    id: "claude.data-attr",
    tool: "claude",
    tier: "S0",
    humanLabel: "Claude/Anthropic data attributes",
    surfaces: ["live_html", "paste_html"],
    why: "Provider data-* attributes left by Claude/Anthropic UI markup.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(
        /\s(data-claude-[\w-]+|data-anthropic-[\w-]+)\s*=\s*["'][^"']*["']/i,
      );
      return m ? clip(m[0].trim()) : null;
    },
  },
];
