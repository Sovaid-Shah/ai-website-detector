import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

export const base44Rules: RuleDefinition[] = [
  {
    id: "base44.host",
    builder: "base44",
    strength: "strong",
    humanLabel: "Hosted on a Base44 domain",
    weight: 40,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["base44.app", "base44.ai"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "base44.assets",
    builder: "base44",
    strength: "strong",
    humanLabel: "Base44 asset or API host in page",
    weight: 35,
    match: ({ haystack }) =>
      findInHaystack(haystack, ["base44.app", "base44.ai", "base44cdn"]),
  },
];
