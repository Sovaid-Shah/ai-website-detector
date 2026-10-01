import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

export const replitRules: RuleDefinition[] = [
  {
    id: "replit.host",
    builder: "replit",
    strength: "strong",
    humanLabel: "Hosted on Replit",
    weight: 40,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["replit.app", "replit.dev", "repl.co"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "replit.assets",
    builder: "replit",
    strength: "strong",
    humanLabel: "Replit runtime or asset hosts",
    weight: 30,
    match: ({ haystack }) =>
      findInHaystack(haystack, [
        "replit.com",
        "replit.app",
        "repl.co",
        "replit-cdn",
      ]),
  },
  {
    id: "replit.banner",
    builder: "replit",
    strength: "medium",
    humanLabel: "Replit banner or badge markup",
    weight: 20,
    match: ({ snapshot, haystack }) => {
      if (
        snapshot.matchedSelectors.some((s) =>
          s.toLowerCase().includes("replit"),
        )
      ) {
        return "replit selector";
      }
      return findInHaystack(haystack, ["made on replit", "replit-badge"]);
    },
  },
];
