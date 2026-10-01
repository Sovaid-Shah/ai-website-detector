import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreSnapshot } from "./score.js";
import type { PageSnapshot } from "./types.js";

function emptySnapshot(over: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://example.com/",
    hostname: "example.com",
    meta: {},
    scriptSrcs: [],
    linkHrefs: [],
    resourceUrls: [],
    htmlExcerpt: "<html><body><div class=\"flex min-h-screen\">shadcn tailwind</div></body></html>",
    matchedSelectors: [],
    ...over,
  };
}

describe("scoreSnapshot", () => {
  it("returns insufficient_signal for generic React/Tailwind control", () => {
    const result = scoreSnapshot(emptySnapshot());
    assert.equal(result.verdict, "insufficient_signal");
    assert.equal(result.detectedBuilders.length, 0);
    assert.equal(result.confidence, 0);
  });

  it("detects Lovable host as likely_ai_builder", () => {
    const result = scoreSnapshot(
      emptySnapshot({
        url: "https://my-app.lovable.app/",
        hostname: "my-app.lovable.app",
      }),
    );
    assert.equal(result.verdict, "likely_ai_builder");
    assert.ok(result.detectedBuilders.includes("lovable"));
    assert.ok(result.signals.some((s) => s.id === "lovable.host"));
  });

  it("detects Framer as platform_only not AI-built", () => {
    const result = scoreSnapshot(
      emptySnapshot({
        meta: { generator: "Framer 2024" },
        resourceUrls: ["https://framerusercontent.com/images/x.png"],
      }),
    );
    assert.equal(result.verdict, "platform_only");
    assert.deepEqual(result.detectedBuilders, ["framer"]);
  });

  it("detects v0 preview host", () => {
    const result = scoreSnapshot(
      emptySnapshot({
        url: "https://xyz.vusercontent.net/",
        hostname: "xyz.vusercontent.net",
      }),
    );
    assert.equal(result.verdict, "likely_ai_builder");
    assert.ok(result.detectedBuilders.includes("v0"));
  });

  it("handles hostile evidence strings without throwing", () => {
    const result = scoreSnapshot(
      emptySnapshot({
        hostname: "demo.lovable.app",
        url: "https://demo.lovable.app/",
        htmlExcerpt: '<meta name="author" content="<script>alert(1)</script> Lovable">',
        meta: { author: "<script>alert(1)</script> Lovable" },
      }),
    );
    assert.equal(result.verdict, "likely_ai_builder");
  });
});
