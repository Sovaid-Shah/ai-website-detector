export const RULES_VERSION = "1.0.0";

export type Verdict =
  | "likely_ai_builder"
  | "platform_only"
  | "insufficient_signal";

export type BuilderId =
  | "lovable"
  | "bolt"
  | "base44"
  | "replit"
  | "framer"
  | "v0";

export type SignalStrength = "strong" | "medium" | "weak";

export interface PageSnapshot {
  url: string;
  hostname: string;
  meta: Record<string, string>;
  scriptSrcs: string[];
  linkHrefs: string[];
  resourceUrls: string[];
  htmlExcerpt: string;
  matchedSelectors: string[];
  headers?: Record<string, string>;
}

export interface DetectedSignal {
  id: string;
  builder: BuilderId;
  strength: SignalStrength;
  humanLabel: string;
  evidence: string;
  weight: number;
}

export interface QuotaStatus {
  remainingFree: number;
  freeLimit: number;
  usedHosts: string[];
  requiresLogin: boolean;
  monthlyRemaining: number | null;
  monthlyLimit: number | null;
  isLoggedIn: boolean;
}

export interface ScanResult {
  verdict: Verdict;
  confidence: number;
  summary: string;
  detectedBuilders: BuilderId[];
  signals: DetectedSignal[];
  rulesVersion: string;
  limitsDisclaimer: string;
  quota?: QuotaStatus;
  serverFetchFailed?: string;
}
