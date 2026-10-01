import { ALL_RULES, PLATFORM_ONLY_BUILDERS } from "./packs/index.js";
import { runRules } from "./match.js";
import {
  RULES_VERSION,
  type BuilderId,
  type PageSnapshot,
  type ScanResult,
  type Verdict,
} from "./types.js";

const LIMITS_DISCLAIMER =
  "This checks for known AI site-builder fingerprints (hosts, badges, CDNs, meta). It cannot tell if Cursor, Copilot, or ChatGPT helped write code, and cleaned exports may show no signal.";

function summaryFor(verdict: Verdict, builders: BuilderId[]): string {
  if (verdict === "insufficient_signal") {
    return "Not enough strong fingerprints to say this was made with an AI site builder.";
  }
  if (verdict === "platform_only") {
    return `This looks like a ${builders.join(", ")} site. That means the platform, not proof that AI built every part.`;
  }
  return `Strong fingerprints point to ${builders.join(", ")}. Treat this as technical inference, not a legal claim.`;
}

export function scoreSnapshot(snapshot: PageSnapshot): ScanResult {
  const signals = runRules(snapshot, ALL_RULES);
  const strong = signals.filter((s) => s.strength === "strong");

  const strongAi = strong.filter((s) => !PLATFORM_ONLY_BUILDERS.has(s.builder));
  const strongPlatform = strong.filter((s) =>
    PLATFORM_ONLY_BUILDERS.has(s.builder),
  );

  let verdict: Verdict = "insufficient_signal";
  let detectedBuilders: BuilderId[] = [];

  if (strongAi.length > 0) {
    verdict = "likely_ai_builder";
    detectedBuilders = [...new Set(strongAi.map((s) => s.builder))];
  } else if (strongPlatform.length > 0) {
    verdict = "platform_only";
    detectedBuilders = [...new Set(strongPlatform.map((s) => s.builder))];
  }

  const weightSum = signals
    .filter((s) => detectedBuilders.includes(s.builder) || verdict === "insufficient_signal")
    .reduce((a, s) => a + s.weight, 0);

  const confidence =
    verdict === "insufficient_signal"
      ? 0
      : Math.min(99, Math.round(45 + weightSum * 0.5 + strong.length * 8));

  return {
    verdict,
    confidence,
    summary: summaryFor(verdict, detectedBuilders),
    detectedBuilders,
    signals,
    rulesVersion: RULES_VERSION,
    limitsDisclaimer: LIMITS_DISCLAIMER,
  };
}

export { RULES_VERSION, ALL_RULES };
