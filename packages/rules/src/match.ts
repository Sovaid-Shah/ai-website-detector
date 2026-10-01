import type { BuilderId, DetectedSignal, PageSnapshot, SignalStrength } from "./types.js";

export interface RuleDefinition {
  id: string;
  builder: BuilderId;
  strength: SignalStrength;
  humanLabel: string;
  weight: number;
  /** platform_only builders never become likely_ai_builder alone */
  platformOnly?: boolean;
  match: (ctx: MatchContext) => string | null;
}

export interface MatchContext {
  snapshot: PageSnapshot;
  haystack: string;
}

export function buildHaystack(snapshot: PageSnapshot): string {
  const parts = [
    snapshot.url,
    snapshot.hostname,
    ...Object.entries(snapshot.meta).map(([k, v]) => `${k}:${v}`),
    ...snapshot.scriptSrcs,
    ...snapshot.linkHrefs,
    ...snapshot.resourceUrls,
    ...snapshot.matchedSelectors,
    snapshot.htmlExcerpt,
    ...(snapshot.headers
      ? Object.entries(snapshot.headers).map(([k, v]) => `${k}:${v}`)
      : []),
  ];
  return parts.join("\n").toLowerCase();
}

export function runRules(
  snapshot: PageSnapshot,
  rules: RuleDefinition[],
): DetectedSignal[] {
  const ctx: MatchContext = { snapshot, haystack: buildHaystack(snapshot) };
  const signals: DetectedSignal[] = [];

  for (const rule of rules) {
    try {
      const evidence = rule.match(ctx);
      if (!evidence) continue;
      signals.push({
        id: rule.id,
        builder: rule.builder,
        strength: rule.strength,
        humanLabel: rule.humanLabel,
        evidence: evidence.slice(0, 280),
        weight: rule.weight,
      });
    } catch {
      // Never let one bad rule break a scan
    }
  }

  return signals;
}

export function hostIncludes(hostname: string, suffixes: string[]): boolean {
  const h = hostname.toLowerCase();
  return suffixes.some((s) => h === s || h.endsWith(`.${s}`));
}

export function findInHaystack(haystack: string, needles: string[]): string | null {
  for (const n of needles) {
    const needle = n.toLowerCase();
    if (haystack.includes(needle)) return n;
  }
  return null;
}
