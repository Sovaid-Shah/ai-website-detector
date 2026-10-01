import type { PatternDefinition } from "../types.js";

/** Gated weak style hints — never promoted to tool certainty. */
export const styleWeakPatterns: PatternDefinition[] = [
  {
    id: "style.em-dash-density",
    tool: "unknown_ai",
    tier: "S3",
    humanLabel: "High em-dash density in text",
    surfaces: ["paste_text", "live_html"],
    why: "Em-dash heavy prose is a weak stylistic hint. High false positive rate; never treat as proof.",
    match: (input) => {
      const text = input.text ?? stripTags(input.html ?? "");
      if (text.length < 400) return null;
      const dashes = (text.match(/—/g) ?? []).length;
      const perK = (dashes / text.length) * 1000;
      if (perK >= 3 && dashes >= 4) {
        return `${dashes} em-dashes (~${perK.toFixed(1)}/1k chars)`;
      }
      return null;
    },
  },
];

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}
