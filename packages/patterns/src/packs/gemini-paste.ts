import type { PatternDefinition } from "../types.js";

function clip(value: string, max = 220): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export const geminiPastePatterns: PatternDefinition[] = [
  {
    id: "gemini.sourcepos",
    tool: "gemini",
    tier: "S1",
    humanLabel: "Gemini-like data-sourcepos attribute",
    surfaces: ["live_html", "paste_html"],
    why: "Gemini paste HTML sometimes includes data-sourcepos. Other tools may use similar attrs, so tier is S1.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(/data-sourcepos\s*=\s*["'][^"']+["']/i);
      return m ? clip(m[0]) : null;
    },
  },
  {
    id: "gemini.path-to-node",
    tool: "gemini",
    tier: "S1",
    humanLabel: "Gemini data-path-to-node attribute",
    surfaces: ["live_html", "paste_html"],
    why: "Cross-node Gemini selections can include data-path-to-node.",
    match: (input) => {
      const html = input.html ?? "";
      const m = html.match(/data-path-to-node\s*=\s*["'][^"']+["']/i);
      return m ? clip(m[0]) : null;
    },
  },
];
