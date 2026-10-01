import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

export const boltRules: RuleDefinition[] = [
  {
    id: "bolt.host",
    builder: "bolt",
    strength: "strong",
    humanLabel: "Hosted on a Bolt domain",
    weight: 40,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["bolt.host", "bolt.new"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "bolt.cdn",
    builder: "bolt",
    strength: "strong",
    humanLabel: "Bolt or StackBlitz CDN assets",
    weight: 35,
    match: ({ haystack }) =>
      findInHaystack(haystack, [
        "stackblitz.com",
        "blitz.cdn",
        "bolt.new",
        "webcontainer.io",
      ]),
  },
  {
    id: "bolt.meta",
    builder: "bolt",
    strength: "medium",
    humanLabel: "Meta or markup mentions Bolt",
    weight: 20,
    match: ({ snapshot, haystack }) => {
      const meta = Object.values(snapshot.meta).join(" ").toLowerCase();
      if (meta.includes("bolt.new") || meta.includes("built with bolt")) {
        return Object.values(snapshot.meta).find((v) => /bolt/i.test(v)) ?? "bolt meta";
      }
      return findInHaystack(haystack, ["data-bolt", "bolt-diy"]);
    },
  },
];
