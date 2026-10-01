import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

/** Framer proves platform, not Framer AI specifically → platformOnly */
export const framerRules: RuleDefinition[] = [
  {
    id: "framer.host",
    builder: "framer",
    strength: "strong",
    humanLabel: "Hosted on Framer",
    weight: 30,
    platformOnly: true,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["framer.website", "framer.app", "framercanvas.com"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "framer.generator",
    builder: "framer",
    strength: "strong",
    humanLabel: "Generator meta set to Framer",
    weight: 35,
    platformOnly: true,
    match: ({ snapshot }) => {
      const g = snapshot.meta.generator ?? snapshot.meta.Generator ?? "";
      return /framer/i.test(g) ? g : null;
    },
  },
  {
    id: "framer.cdn",
    builder: "framer",
    strength: "strong",
    humanLabel: "Framer CDN or content hosts",
    weight: 30,
    platformOnly: true,
    match: ({ haystack }) =>
      findInHaystack(haystack, [
        "framerusercontent.com",
        "framercdn.com",
        "events.framer.com",
      ]),
  },
  {
    id: "framer.badge",
    builder: "framer",
    strength: "strong",
    humanLabel: "Framer badge container present",
    weight: 30,
    platformOnly: true,
    match: ({ snapshot }) =>
      snapshot.matchedSelectors.includes("#__framer-badge-container")
        ? "#__framer-badge-container"
        : null,
  },
];
