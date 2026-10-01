import type { RuleDefinition } from "../match.js";
import { base44Rules } from "./base44.js";
import { boltRules } from "./bolt.js";
import { framerRules } from "./framer.js";
import { lovableRules } from "./lovable.js";
import { replitRules } from "./replit.js";
import { v0Rules } from "./v0.js";

export const ALL_RULES: RuleDefinition[] = [
  ...lovableRules,
  ...boltRules,
  ...base44Rules,
  ...replitRules,
  ...framerRules,
  ...v0Rules,
];

export const PLATFORM_ONLY_BUILDERS = new Set(
  ALL_RULES.filter((r) => r.platformOnly).map((r) => r.builder),
);
