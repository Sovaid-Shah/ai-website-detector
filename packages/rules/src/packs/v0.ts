import type { RuleDefinition } from "../match.js";
import { findInHaystack, hostIncludes } from "../match.js";

export const v0Rules: RuleDefinition[] = [
  {
    id: "v0.host",
    builder: "v0",
    strength: "strong",
    humanLabel: "v0 preview host",
    weight: 40,
    match: ({ snapshot }) =>
      hostIncludes(snapshot.hostname, ["vusercontent.net", "v0.dev"])
        ? snapshot.hostname
        : null,
  },
  {
    id: "v0.props",
    builder: "v0",
    strength: "strong",
    humanLabel: "v0 tracking attributes in markup",
    weight: 35,
    match: ({ haystack }) => findInHaystack(haystack, ["__v0_i", "__v0_s", "data-v0-"]),
  },
];
