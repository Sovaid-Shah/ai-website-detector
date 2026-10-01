import type { PatternDefinition } from "../types.js";

const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const EXOTIC_SPACE = /[\u2000-\u200A\u202F\u205F\u3000]/g;

export const unicodeHygienePatterns: PatternDefinition[] = [
  {
    id: "unicode.zero-width",
    tool: "unicode",
    tier: "S3",
    humanLabel: "Zero-width or format characters in text/HTML",
    surfaces: ["live_html", "paste_html", "paste_text"],
    why: "Hidden Unicode can come from chat UIs or editors. It is hygiene evidence, not proof of a specific model.",
    match: (input) => {
      const blob = `${input.html ?? ""}${input.text ?? ""}`;
      const hits = blob.match(ZERO_WIDTH);
      if (!hits || hits.length === 0) return null;
      return `${hits.length} zero-width/format char(s)`;
    },
  },
  {
    id: "unicode.exotic-space",
    tool: "unicode",
    tier: "S3",
    humanLabel: "Exotic Unicode spaces",
    surfaces: ["live_html", "paste_html", "paste_text"],
    why: "Thin/hair/ideographic spaces sometimes ride along with pasted AI chat HTML. Weak alone.",
    match: (input) => {
      const blob = `${input.html ?? ""}${input.text ?? ""}`;
      const hits = blob.match(EXOTIC_SPACE);
      if (!hits || hits.length === 0) return null;
      return `${hits.length} exotic space char(s)`;
    },
  },
];
