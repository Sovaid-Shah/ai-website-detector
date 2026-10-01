# Pattern detector design

## Goal

Detect **technical leftovers** that tools leave behind. Never claim authorship from style alone.

Three input surfaces:

1. **Live page** (extension + URL scan) — DOM / HTML / assets  
2. **Pasted rich text** (optional later) — clipboard HTML from chat UIs  
3. **Repo / PR** (GitHub URL) — commits, files, footers for Cursor / Codex / Claude Code  

---

## Signal tiers

| Tier | Meaning | Example |
|------|---------|---------|
| **S0 strong deterministic** | Byte/string match, near-zero FP | `font-claude-response-body`, Lovable host, `Co-Authored-By: Claude` |
| **S1 strong contextual** | Strong only with context | ChatGPT `data-message-author-role` in page HTML |
| **S2 medium repo** | Tool used on project if public repo | `.cursorrules`, `codex/` branch, Copilot bot commits |
| **S3 weak style** | Hint only, high FP | em-dash density, shadcn+vibe layout |
| **S4 statistical** | Provider watermark needing private key | Anthropic Claude text watermark (EU 2026) — **we cannot verify** |

Product rule: verdict labels must name the **tier**. Never promote S3 to “made with Cursor.”

---

## What research shows (2025–2026)

### Claude (Anthropic)

**Detectable today (S0):** Chat UI paste leftovers  
- CSS class containing `claude`, esp. `font-claude-response-body`  
- Refs: [claude-watermark-checker](https://github.com/OfirYC/claude-watermark-checker), Wikimedia paste studies  

**Not publicly detectable:** Model-level statistical watermark (word-choice bias). Detection API private. Do not fake this.

**Also S0 in git:** Claude Code PR footers / `Co-Authored-By: Claude …` ([coderbuds/ai-detector](https://github.com/coderbuds/ai-detector))

### ChatGPT / GPT

**S1 paste:** `data-message-author-role`, `data-message-id`, `data-message-model-slug`, sometimes `data-start` / `data-end` when selecting across nodes. Copy-button path often plain text = invisible.

**Not:** Stable code watermark in shipped JS for Codex/ChatGPT completions.

### Cursor

**No public code watermark in compiled sites.** Live `algovortex.co` HTML will not say “made with Cursor.”

**S0 git (confirmed on AlgoVortex):**  
- `Co-authored-by: Cursor <cursoragent@cursor.com>`

**S2 repo:**  
- `.cursorrules` (legacy), `.cursor/rules/*.mdc`, `.cursorignore`  
- `.agents/skills/**`, root `skills-lock.json`, `AGENTS.md`  
- Cursor Blame exists but Enterprise + Cursor servers — not for us

### Codex (OpenAI)

**S2:** Branch patterns (`codex/…`), PR labels, bot markers (coderbuds).  
**Not:** Invisible Unicode in completions (community scans found none in API code paths).

### Copilot

**Not:** Unicode watermark in inline code.  
**Org telemetry** (Sonar ↔ Copilot usage) — needs GitHub org access, not a public page scan.

### AI site builders

Keep existing S0 packs: Lovable, Bolt, Base44, Replit, Framer, v0.

---

## Architecture

```
packages/patterns/
  types.ts          Pattern, Match, PatternResult, Surface
  registry.ts       all packs
  engine.ts         runPatterns(input) → scored report
  packs/
    claude-paste.ts
    chatgpt-paste.ts
    gemini-paste.ts
    unicode-hygiene.ts   # ZWSP etc — report as hygiene, not “AI proof”
    builders/            # move or wrap existing rules packs
    repo-cursor.ts
    repo-codex.ts
    repo-claude-code.ts
    repo-copilot.ts
    style-weak.ts        # optional, gated
```

### Input types

```ts
type Surface = "live_html" | "paste_html" | "paste_text" | "repo_tree" | "git_meta";

interface PatternInput {
  surface: Surface;
  url?: string;
  html?: string;          // live or paste
  text?: string;          // plain
  repoFiles?: string[];   // paths
  commits?: { message: string; author: string; coAuthors?: string[] }[];
  branches?: string[];
  prBody?: string;
  labels?: string[];
}

interface PatternMatch {
  id: string;
  tool: "claude" | "chatgpt" | "gemini" | "cursor" | "codex" | "copilot" | "lovable" | …;
  tier: "S0" | "S1" | "S2" | "S3";
  humanLabel: string;
  evidence: string;
  surface: Surface;
}
```

### Report shape (UI)

```
Builder fingerprints:  [Lovable S0] …
Chat paste leftovers:  [Claude class S0] …
Repo / git markers:    [Cursor rules S2] [Codex branch S2] …
Weak style (optional): [ … S3 ]  “not proof”
Statistical watermark: “not checkable without provider API”
```

---

## Pattern packs (v1 implement)

### A. Live / paste HTML — `claude-paste`

- Regex: `class=["'][^"']*claude[^"']*["']`  
- Known: `font-claude-response-body`  
- `data-claude-*`, `data-anthropic-*`

### B. Live / paste HTML — `chatgpt-paste`

- `data-message-author-role`  
- `data-message-model-slug`  
- `data-gpt-*`, `data-openai-*`, `data-chatgpt-*`  
- `data-start` / `data-end` (weaker alone)

### C. Live / paste HTML — `gemini-paste`

- `data-sourcepos`, `data-path-to-node` (mark medium; may be generic)

### D. Unicode hygiene — `unicode-hygiene`

- ZWSP U+200B, ZWNJ, ZWJ, BOM, exotic spaces  
- Label: “hidden characters present” — **not** “Claude wrote this”

### E. Repo — Cursor / Codex / Claude Code / Copilot

From [coderbuds/ai-detector](https://github.com/coderbuds/ai-detector) style rules:

| Tool | Patterns |
|------|----------|
| Claude Code | Footer links, `Co-Authored-By: Claude` |
| Cursor | Footers, `.cursorrules`, `.cursor/rules` |
| Codex | `codex/` branches, labels |
| Copilot | `github-copilot[bot]`, co-author tags |
| Aider / Devin / Windsurf | Same class of footers |

Needs GitHub API (public repos free) or user-pasted tree listing.

**Implemented:** `POST /api/github` + `POST /api/patterns` with `githubUrl`.
Response includes `github.verification`:
- `parsed` owner/repo from input
- `resolved.fullName` from GitHub API
- `verified: true` only when they match
- Private repos need Worker secret `GITHUB_TOKEN`

**Verified target:** `umarhayatdeveloper24/algovortex` (private). SSH clone + local pattern run hit Cursor S0 co-author + skills-lock. Unauthenticated API returns 404 until token set.

### F. Builders

Existing `@ai-detector/rules` packs stay S0 on `live_html`.

---

## Engine algorithm

1. Select packs by `surface`  
2. Run all matches → `PatternMatch[]`  
3. Group by `tool` + highest tier  
4. Verdict policy:

```
if any S0 builder → likely_ai_builder (existing)
if any S0/S1 paste → “chat UI paste leftovers: {tools}”
if any S2 repo → “repo markers suggest tool use: {tools}”
if only S3 → insufficient_signal + weak hints
never: “built by Cursor” from live_html alone
```

5. Version `patternsVersion` like `rulesVersion`; quarterly refresh (UI selectors rot).

---

## Product UX

- Extension: scan tab HTML with paste packs + builders  
- Web: URL scan = builders + HTML paste leftovers if present in page source  
- New: “Scan GitHub repo” field → S2  
- Report sections always show **tier badge**

---

## What we still refuse to claim

- Anthropic statistical watermark without their detector  
- OpenAI SynthID on code (images/audio only in public provenance docs)  
- Module-level authorship  
- Copilot without org telemetry  

---

## Build order

1. `packages/patterns` + Claude/ChatGPT paste packs + unicode  
2. Wire into live collector / score report UI  
3. GitHub repo scanner (S2 Cursor/Codex/Claude Code)  
4. Weak style pack behind toggle  
5. Corpus fixtures + FP tests (Tailwind site must stay clean)

---

## Honest product line

> We detect **leftovers**: builder hosts, chat-paste HTML (Claude/ChatGPT), and repo markers (Cursor/Codex).  
> We do **not** decrypt secret model watermarks or invent IDE attribution from clean production bundles.
