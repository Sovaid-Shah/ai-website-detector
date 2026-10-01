import { claudePastePatterns } from "./claude-paste.js";
import { chatgptPastePatterns } from "./chatgpt-paste.js";
import { geminiPastePatterns } from "./gemini-paste.js";
import { unicodeHygienePatterns } from "./unicode-hygiene.js";
import { repoCursorPatterns } from "./repo-cursor.js";
import { repoCodexPatterns } from "./repo-codex.js";
import { repoClaudeCodePatterns } from "./repo-claude-code.js";
import { repoCopilotPatterns } from "./repo-copilot.js";
import { styleWeakPatterns } from "./style-weak.js";
import type { PatternDefinition } from "../types.js";

export const ALL_PATTERNS: PatternDefinition[] = [
  ...claudePastePatterns,
  ...chatgptPastePatterns,
  ...geminiPastePatterns,
  ...unicodeHygienePatterns,
  ...repoCursorPatterns,
  ...repoCodexPatterns,
  ...repoClaudeCodePatterns,
  ...repoCopilotPatterns,
  ...styleWeakPatterns,
];
