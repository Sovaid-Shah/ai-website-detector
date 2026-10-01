import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

export const lovableRules: RuleDefinition[] = [
  {
    id: "lovable.host",
    builder: "lovable",
    strength: "strong",
    humanLabel: "Hosted on a Lovable domain",
    weight: 40,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["lovable.app", "lovable.dev"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "lovable.badge",
    builder: "lovable",
    strength: "strong",
    humanLabel: "Lovable badge element present",
    weight: 35,
    match: ({ snapshot }) =>
      snapshot.matchedSelectors.includes("#lovable-badge") ||
      snapshot.matchedSelectors.includes("[data-lovable-badge]")
        ? "lovable badge selector"
        : null,
  },
  {
    id: "lovable.meta",
    builder: "lovable",
    strength: "strong",
    humanLabel: "Meta tags mention Lovable",
    weight: 30,
    match: ({ snapshot }) => {
      const blob = Object.values(snapshot.meta).join(" ").toLowerCase();
      if (blob.includes("lovable")) return Object.values(snapshot.meta).find((v) => /lovable/i.test(v)) ?? "lovable meta";
      return null;
    },
  },
  {
    id: "lovable.uploads",
    builder: "lovable",
    strength: "strong",
    humanLabel: "Asset path uses /lovable-uploads/",
    weight: 30,
    match: ({ haystack }) => findInHaystack(haystack, ["/lovable-uploads/"]),
  },
  {
    id: "lovable.gpteng",
    builder: "lovable",
    strength: "medium",
    humanLabel: "Legacy GPT Engineer / Lovable CDN reference",
    weight: 20,
    match: ({ haystack }) =>
      findInHaystack(haystack, ["cdn.gpteng.co", "gptengineer.js", "gpteng"]),
  },
];
