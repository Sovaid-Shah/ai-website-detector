import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runPatterns, ALL_PATTERNS } from "./index.js";

describe("runPatterns — Claude paste", () => {
  it("detects font-claude-response-body as S0", () => {
    const report = runPatterns({
      surface: "paste_html",
      html: `<p class="font-claude-response-body text-pretty">Hello from Claude</p>`,
    });
    assert.ok(report.tools.includes("claude"));
    assert.equal(report.highestTier.claude, "S0");
    assert.ok(
      report.matches.some((m) => m.id === "claude.class.font-response-body"),
    );
  });

  it("detects generic claude class when specific one absent", () => {
    const report = runPatterns({
      surface: "live_html",
      html: `<div class="claude-markdown prose">x</div>`,
    });
    assert.ok(report.matches.some((m) => m.id === "claude.class.any"));
  });

  it("detects data-claude attributes", () => {
    const report = runPatterns({
      surface: "paste_html",
      html: `<span data-claude-turn="assistant">hi</span>`,
    });
    assert.ok(report.matches.some((m) => m.id === "claude.data-attr"));
  });
});

describe("runPatterns — ChatGPT paste", () => {
  it("detects data-message-author-role as S1", () => {
    const report = runPatterns({
      surface: "paste_html",
      html: `<div data-message-author-role="assistant" data-message-id="abc">Hi</div>`,
    });
    assert.ok(report.tools.includes("chatgpt"));
    assert.equal(report.highestTier.chatgpt, "S1");
    assert.ok(
      report.matches.some((m) => m.id === "chatgpt.message-author-role"),
    );
  });

  it("detects model slug and start/end together", () => {
    const report = runPatterns({
      surface: "paste_html",
      html: `<div data-message-model-slug="gpt-4o" data-start="12" data-end="40">x</div>`,
    });
    assert.ok(report.matches.some((m) => m.id === "chatgpt.model-slug"));
    assert.ok(report.matches.some((m) => m.id === "chatgpt.data-start-end"));
  });
});

describe("runPatterns — Gemini paste", () => {
  it("detects data-sourcepos", () => {
    const report = runPatterns({
      surface: "paste_html",
      html: `<p data-sourcepos="1:1-1:20">text</p>`,
    });
    assert.ok(report.tools.includes("gemini"));
    assert.ok(report.matches.some((m) => m.id === "gemini.sourcepos"));
  });
});

describe("runPatterns — unicode hygiene", () => {
  it("flags zero-width chars as S3 unicode, not a model", () => {
    const report = runPatterns({
      surface: "paste_text",
      text: `Hello\u200Bworld`,
    });
    assert.ok(report.tools.includes("unicode"));
    assert.equal(report.highestTier.unicode, "S3");
    assert.ok(!report.tools.includes("claude"));
    assert.ok(!report.tools.includes("chatgpt"));
  });
});

describe("runPatterns — Cursor repo", () => {
  it("detects .cursorrules and .cursor/rules/*.mdc", () => {
    const report = runPatterns({
      surface: "repo_tree",
      repoFiles: [
        "README.md",
        ".cursorrules",
        ".cursor/rules/project.mdc",
        "src/index.ts",
      ],
    });
    assert.ok(report.tools.includes("cursor"));
    assert.equal(report.highestTier.cursor, "S2");
    assert.ok(report.matches.some((m) => m.id === "cursor.cursorrules"));
    assert.ok(report.matches.some((m) => m.id === "cursor.rules-mdc"));
  });

  it("detects AlgoVortex-style agent skills layout", () => {
    const report = runPatterns({
      surface: "repo_tree",
      repoFiles: [
        "README.md",
        "skills-lock.json",
        ".agents/skills/caveman/SKILL.md",
        "app/page.tsx",
      ],
    });
    assert.ok(report.tools.includes("cursor"));
    assert.ok(report.matches.some((m) => m.id === "cursor.skills-lock"));
    assert.ok(report.matches.some((m) => m.id === "cursor.agents-skills"));
  });

  it("detects Co-authored-by: Cursor as S0 (AlgoVortex commit shape)", () => {
    const report = runPatterns({
      surface: "git_meta",
      commits: [
        {
          message:
            "chore: commit transparent brand WebP logos\n\nCo-authored-by: Cursor <cursoragent@cursor.com>",
          author: "umar.hayat.developer24@gmail.com",
        },
      ],
    });
    assert.ok(report.tools.includes("cursor"));
    assert.equal(report.highestTier.cursor, "S0");
    assert.ok(report.matches.some((m) => m.id === "cursor.co-authored"));
  });
});

describe("runPatterns — Codex / Copilot / Claude Code git", () => {
  it("detects Codex branch", () => {
    const report = runPatterns({
      surface: "git_meta",
      branches: ["main", "codex/fix-login"],
    });
    assert.ok(report.tools.includes("codex"));
    assert.ok(report.matches.some((m) => m.id === "codex.branch"));
  });

  it("detects Claude Code Co-Authored-By as S0", () => {
    const report = runPatterns({
      surface: "git_meta",
      commits: [
        {
          message:
            "feat: add login\n\nCo-Authored-By: Claude <noreply@anthropic.com>",
          author: "dev@example.com",
        },
      ],
    });
    assert.ok(report.tools.includes("claude_code"));
    assert.equal(report.highestTier.claude_code, "S0");
  });

  it("detects Copilot bot author", () => {
    const report = runPatterns({
      surface: "git_meta",
      commits: [
        {
          message: "Implement feature",
          author: "github-copilot[bot]",
        },
      ],
    });
    assert.ok(report.tools.includes("copilot"));
    assert.equal(report.highestTier.copilot, "S2");
  });
});

describe("runPatterns — weak style gated", () => {
  it("skips em-dash density unless includeWeakStyle", () => {
    const text = `${"word ".repeat(100)}— ${"word ".repeat(20)}— ${"word ".repeat(20)}— ${"word ".repeat(20)}— end`;
    const off = runPatterns({ surface: "paste_text", text });
    assert.ok(!off.matches.some((m) => m.id === "style.em-dash-density"));
    const on = runPatterns(
      { surface: "paste_text", text },
      { includeWeakStyle: true },
    );
    assert.ok(on.matches.some((m) => m.id === "style.em-dash-density"));
  });
});

describe("runPatterns — control / honesty", () => {
  it("returns empty matches for clean HTML", () => {
    const report = runPatterns({
      surface: "live_html",
      html: `<html><body><h1>Hello</h1><p>Normal site.</p></body></html>`,
      url: "https://example.com/",
    });
    assert.equal(report.matches.length, 0);
    assert.ok(report.summary.toLowerCase().includes("no technical leftover"));
    assert.ok(report.statisticalNote.length > 20);
  });

  it("registry has expected packs", () => {
    assert.ok(ALL_PATTERNS.length >= 15);
    const ids = new Set(ALL_PATTERNS.map((p) => p.id));
    assert.ok(ids.has("claude.class.font-response-body"));
    assert.ok(ids.has("chatgpt.message-author-role"));
    assert.ok(ids.has("cursor.cursorrules"));
    assert.ok(ids.has("claude-code.co-authored"));
  });
});
