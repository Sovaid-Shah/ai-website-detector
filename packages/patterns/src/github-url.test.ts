import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseGithubRepoUrl,
  githubNamesMatch,
} from "./github-url.js";
import { runPatternSurfaces } from "./engine.js";

describe("parseGithubRepoUrl", () => {
  it("parses AlgoVortex HTTPS, SSH, and short forms to same owner/repo", () => {
    const expected = {
      owner: "umarhayatdeveloper24",
      repo: "algovortex",
    };
    const samples = [
      "https://github.com/umarhayatdeveloper24/algovortex",
      "https://github.com/umarhayatdeveloper24/algovortex.git",
      "https://www.github.com/umarhayatdeveloper24/algovortex/tree/main",
      "git@github.com:umarhayatdeveloper24/algovortex.git",
      "umarhayatdeveloper24/algovortex",
    ];
    for (const sample of samples) {
      const parsed = parseGithubRepoUrl(sample);
      assert.ok(parsed, `failed to parse ${sample}`);
      assert.equal(parsed.owner, expected.owner);
      assert.equal(parsed.repo, expected.repo);
      assert.equal(
        parsed.htmlUrl,
        "https://github.com/umarhayatdeveloper24/algovortex",
      );
      assert.ok(
        githubNamesMatch(parsed, "umarhayatdeveloper24/algovortex"),
      );
    }
  });

  it("rejects non-GitHub hosts", () => {
    assert.equal(parseGithubRepoUrl("https://gitlab.com/a/b"), null);
    assert.equal(parseGithubRepoUrl("https://example.com/a/b"), null);
  });
});

describe("runPatternSurfaces — AlgoVortex fixture", () => {
  it("hits Cursor S0 + skills markers from real remote shape", () => {
    const report = runPatternSurfaces(
      {
        url: "https://github.com/umarhayatdeveloper24/algovortex",
        repoFiles: [
          "README.md",
          "skills-lock.json",
          ".agents/skills/caveman/SKILL.md",
          "app/page.tsx",
        ],
        commits: [
          {
            message:
              "chore: commit transparent brand WebP logos\n\nCo-authored-by: Cursor <cursoragent@cursor.com>",
            author: "umar.hayat.developer24@gmail.com",
            coAuthors: ["Cursor <cursoragent@cursor.com>"],
          },
        ],
        branches: ["main"],
      },
      ["repo_tree", "git_meta"],
    );
    assert.ok(report.tools.includes("cursor"));
    assert.equal(report.highestTier.cursor, "S0");
    assert.ok(report.matches.some((m) => m.id === "cursor.co-authored"));
    assert.ok(report.matches.some((m) => m.id === "cursor.skills-lock"));
    assert.ok(report.matches.some((m) => m.id === "cursor.agents-skills"));
  });
});
