export const PATTERNS_VERSION = "1.0.0";

export type Surface =
  | "live_html"
  | "paste_html"
  | "paste_text"
  | "repo_tree"
  | "git_meta";

export type PatternTier = "S0" | "S1" | "S2" | "S3";

export type PatternTool =
  | "claude"
  | "chatgpt"
  | "gemini"
  | "cursor"
  | "codex"
  | "copilot"
  | "claude_code"
  | "unicode"
  | "unknown_ai";

export interface PatternInput {
  surface: Surface;
  url?: string;
  html?: string;
  text?: string;
  repoFiles?: string[];
  commits?: Array<{
    message: string;
    author: string;
    coAuthors?: string[];
  }>;
  branches?: string[];
  prBody?: string;
  labels?: string[];
}

export interface PatternMatch {
  id: string;
  tool: PatternTool;
  tier: PatternTier;
  humanLabel: string;
  evidence: string;
  surface: Surface;
  why: string;
}

export interface PatternReport {
  patternsVersion: string;
  matches: PatternMatch[];
  tools: PatternTool[];
  highestTier: Partial<Record<PatternTool, PatternTier>>;
  summary: string;
  statisticalNote: string;
}

export interface PatternDefinition {
  id: string;
  tool: PatternTool;
  tier: PatternTier;
  humanLabel: string;
  surfaces: Surface[];
  why: string;
  match: (input: PatternInput) => string | null;
}
