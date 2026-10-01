import { ALL_PATTERNS } from "./packs/index.js";
import {
  PATTERNS_VERSION,
  type PatternInput,
  type PatternMatch,
  type PatternReport,
  type PatternTier,
  type PatternTool,
  type Surface,
} from "./types.js";

const TIER_RANK: Record<PatternTier, number> = {
  S0: 0,
  S1: 1,
  S2: 2,
  S3: 3,
};

const STATISTICAL_NOTE =
  "We do not claim Anthropic/OpenAI statistical text watermarks. Those need provider keys we do not have. We only report technical leftovers (classes, attributes, repo markers).";

function toolLabel(tool: PatternTool): string {
  switch (tool) {
    case "claude":
      return "Claude paste traces";
    case "chatgpt":
      return "ChatGPT paste traces";
    case "gemini":
      return "Gemini-like paste traces";
    case "cursor":
      return "Cursor (repo)";
    case "codex":
      return "Codex (repo/git)";
    case "copilot":
      return "Copilot (git)";
    case "claude_code":
      return "Claude Code (git)";
    case "unicode":
      return "Unicode hygiene";
    case "unknown_ai":
      return "Weak style hint";
    default:
      return tool;
  }
}

function bestTier(
  a: PatternTier | undefined,
  b: PatternTier,
): PatternTier {
  if (!a) return b;
  return TIER_RANK[b] < TIER_RANK[a] ? b : a;
}

export function runPatterns(
  input: PatternInput,
  options?: { includeWeakStyle?: boolean },
): PatternReport {
  const includeWeak = options?.includeWeakStyle === true;
  const surface: Surface = input.surface;
  const matches: PatternMatch[] = [];

  for (const def of ALL_PATTERNS) {
    if (def.tier === "S3" && def.tool === "unknown_ai" && !includeWeak) {
      continue;
    }
    if (!def.surfaces.includes(surface)) continue;
    let evidence: string | null = null;
    try {
      evidence = def.match(input);
    } catch {
      evidence = null;
    }
    if (!evidence) continue;
    matches.push({
      id: def.id,
      tool: def.tool,
      tier: def.tier,
      humanLabel: def.humanLabel,
      evidence,
      surface,
      why: def.why,
    });
  }

  matches.sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.id.localeCompare(b.id),
  );

  const highestTier: Partial<Record<PatternTool, PatternTier>> = {};
  const tools = new Set<PatternTool>();
  for (const m of matches) {
    tools.add(m.tool);
    highestTier[m.tool] = bestTier(highestTier[m.tool], m.tier);
  }

  const toolList = [...tools];
  let summary: string;
  if (matches.length === 0) {
    summary =
      "No technical leftover patterns matched on this input. That does not mean AI was unused — only that we found no fingerprints we trust.";
  } else {
    const parts = toolList.map((t) => {
      const tier = highestTier[t]!;
      return `${toolLabel(t)} (${tier})`;
    });
    summary = `Found: ${parts.join("; ")}.`;
  }

  return {
    patternsVersion: PATTERNS_VERSION,
    matches,
    tools: toolList,
    highestTier,
    summary,
    statisticalNote: STATISTICAL_NOTE,
  };
}

/** Run packs across several surfaces (repo tree + git meta) and merge. */
export function runPatternSurfaces(
  base: Omit<PatternInput, "surface">,
  surfaces: Surface[],
  options?: { includeWeakStyle?: boolean },
): PatternReport {
  return mergePatternReports(
    ...surfaces.map((surface) =>
      runPatterns({ ...base, surface }, options),
    ),
  );
}

export function mergePatternReports(
  ...reports: PatternReport[]
): PatternReport {
  const byId = new Map<string, PatternMatch>();
  for (const report of reports) {
    for (const match of report.matches) {
      const key = `${match.id}::${match.surface}::${match.evidence}`;
      if (!byId.has(key)) byId.set(key, match);
    }
  }
  const matches = [...byId.values()].sort(
    (a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.id.localeCompare(b.id),
  );

  const highestTier: Partial<Record<PatternTool, PatternTier>> = {};
  const tools = new Set<PatternTool>();
  for (const m of matches) {
    tools.add(m.tool);
    highestTier[m.tool] = bestTier(highestTier[m.tool], m.tier);
  }
  const toolList = [...tools];

  let summary: string;
  if (matches.length === 0) {
    summary =
      "No technical leftover patterns matched on this input. That does not mean AI was unused — only that we found no fingerprints we trust.";
  } else {
    const parts = toolList.map((t) => {
      const tier = highestTier[t]!;
      return `${toolLabel(t)} (${tier})`;
    });
    summary = `Found: ${parts.join("; ")}.`;
  }

  return {
    patternsVersion: PATTERNS_VERSION,
    matches,
    tools: toolList,
    highestTier,
    summary,
    statisticalNote: STATISTICAL_NOTE,
  };
}
