import { scoreSnapshot, type PageSnapshot, type ScanResult } from "@ai-detector/rules";
import { runPatterns, type PatternReport } from "@ai-detector/patterns";
import {
  apiScan,
  apiGithub,
  apiQuota,
  loginUrl,
  privacyUrl,
  mainSiteUrl,
} from "../../utils/api";

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text: string, isError = false): void {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function setGithubStatus(text: string, isError = false): void {
  const el = document.getElementById("github-status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function renderQuota(quota: Record<string, unknown> | undefined): void {
  const el = document.getElementById("quota");
  if (!el || !quota) return;
  if (quota.isLoggedIn) {
    el.textContent = `Signed in · ${String(quota.monthlyRemaining)} / ${String(quota.monthlyLimit)} this month`;
  } else {
    el.textContent = `${String(quota.remainingFree)} / ${String(quota.freeLimit)} free sites left`;
  }
}

function patternsHtml(patterns: PatternReport | undefined): string {
  if (!patterns) return "";
  const rows = patterns.matches
    .map(
      (m) =>
        `<li><strong>${escapeText(m.humanLabel)}</strong> <span class="muted">${escapeText(m.tier)}</span><code>${escapeText(m.evidence)}</code></li>`,
    )
    .join("");
  return `<h3>Technical leftovers</h3><p>${escapeText(patterns.summary)}</p><ul>${rows || "<li>None matched.</li>"}</ul><p class="muted">${escapeText(patterns.statisticalNote)}</p>`;
}

function githubVerifyHtml(github: Record<string, unknown> | undefined): string {
  if (!github) return "";
  const parsed = (github.parsed ?? {}) as Record<string, unknown>;
  const resolved = (github.resolved ?? null) as Record<string, unknown> | null;
  const asked =
    parsed.owner && parsed.repo
      ? `${String(parsed.owner)}/${String(parsed.repo)}`
      : "(unparsed)";
  const got = resolved?.fullName ? String(resolved.fullName) : "not resolved";
  const ok = github.verified === true;
  return `<div class="verify ${ok ? "" : "bad"}"><strong>GitHub target</strong><p>Asked <code>${escapeText(asked)}</code> · returned <code>${escapeText(got)}</code> · ${ok ? "verified" : "NOT verified"}</p><p class="muted">Access ${escapeText(String(github.access ?? "unknown"))}${resolved?.private ? " · private" : ""}</p></div>`;
}

function renderResult(
  result: ScanResult | Record<string, unknown>,
  patterns?: PatternReport,
  github?: Record<string, unknown>,
): void {
  const root = document.getElementById("result");
  if (!root) return;
  const verdict = String(result.verdict ?? "");
  const title =
    verdict === "likely_ai_builder"
      ? "Likely AI site builder"
      : verdict === "platform_only"
        ? "Platform fingerprint only"
        : verdict
          ? "Not enough signal"
          : "Repo pattern report";

  const builders = Array.isArray(result.detectedBuilders)
    ? result.detectedBuilders
        .map((b) => `<span class="chip">${escapeText(String(b))}</span>`)
        .join("")
    : "";

  const signals = Array.isArray(result.signals)
    ? result.signals
        .map((raw) => {
          const s = raw as Record<string, unknown>;
          return `<li><strong>${escapeText(String(s.humanLabel ?? ""))}</strong><code>${escapeText(String(s.evidence ?? ""))}</code></li>`;
        })
        .join("")
    : "";

  const summary = result.summary
    ? `<p>${escapeText(String(result.summary))}</p>`
    : "";
  const disclaimer = result.limitsDisclaimer
    ? `<p class="muted">${escapeText(String(result.limitsDisclaimer))}</p>`
    : "";

  root.innerHTML = `
    <h2>${escapeText(title)}</h2>
    ${summary}
    ${builders ? `<div class="chips">${builders}</div>` : ""}
    ${signals ? `<ul>${signals}</ul>` : ""}
    ${githubVerifyHtml(github)}
    ${patternsHtml(patterns)}
    ${disclaimer}
  `;
}

function collectInPage(): PageSnapshot {
  const meta: Record<string, string> = {};
  document.querySelectorAll("meta[name], meta[property]").forEach((node) => {
    const el = node as HTMLMetaElement;
    const key = (
      el.getAttribute("name") ||
      el.getAttribute("property") ||
      ""
    ).toLowerCase();
    const content = el.getAttribute("content");
    if (key && content) meta[key] = content;
  });

  const scriptSrcs = [...document.scripts].map((s) => s.src).filter(Boolean);
  const linkHrefs = [...document.querySelectorAll("link[href]")]
    .map((l) => (l as HTMLLinkElement).href)
    .filter(Boolean);

  const selectorList = [
    "#lovable-badge",
    "[data-lovable-badge]",
    "#__framer-badge-container",
  ];
  const matchedSelectors = selectorList.filter((sel) =>
    document.querySelector(sel),
  );

  let resourceUrls: string[] = [];
  try {
    resourceUrls = performance
      .getEntriesByType("resource")
      .map((e) => (e as PerformanceResourceTiming).name)
      .slice(0, 200);
  } catch {
    resourceUrls = [];
  }

  return {
    url: location.href,
    hostname: location.hostname,
    meta,
    scriptSrcs,
    linkHrefs,
    resourceUrls,
    htmlExcerpt: document.documentElement.outerHTML.slice(0, 80_000),
    matchedSelectors,
  };
}

function mergeEnabled(): boolean {
  const el = document.getElementById("merge") as HTMLInputElement | null;
  return el?.checked !== false;
}

async function scanActiveTab(): Promise<void> {
  const scanBtn = document.getElementById("scan") as HTMLButtonElement | null;
  if (scanBtn) scanBtn.disabled = true;
  setStatus("Collecting page…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setStatus("No active tab.", true);
      return;
    }

    if (!/^https?:/i.test(tab.url)) {
      setStatus("Open a normal http(s) page first.", true);
      return;
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectInPage,
    });

    const snapshot = injected[0]?.result;
    if (!snapshot) {
      setStatus("Could not read this page.", true);
      return;
    }

    setStatus("Scoring…");
    const offline = scoreSnapshot(snapshot);
    let localPatterns: PatternReport;
    try {
      localPatterns = runPatterns({
        surface: "live_html",
        url: snapshot.url,
        html: snapshot.htmlExcerpt,
        text: snapshot.htmlExcerpt,
      });
    } catch {
      localPatterns = runPatterns({ surface: "live_html", html: "" });
    }

    if (!mergeEnabled()) {
      setStatus("Local-only scan (no quota used).");
      renderResult(offline, localPatterns);
      return;
    }

    const { ok, status, data } = await apiScan({
      url: snapshot.url,
      snapshot,
    });

    if (data.offline) {
      setStatus("Offline preview — does not use a free scan.", false);
      renderResult(offline, localPatterns);
      return;
    }

    if (data.quota && typeof data.quota === "object") {
      renderQuota(data.quota as Record<string, unknown>);
    }

    if (!ok) {
      setStatus(String(data.error ?? "Scan failed"), true);
      if (status === 401 || data.requiresLogin) {
        const login = document.getElementById("login-cta");
        if (login) login.hidden = false;
      }
      return;
    }

    setStatus("Done.");
    const remotePatterns =
      data.patterns && typeof data.patterns === "object"
        ? (data.patterns as PatternReport)
        : localPatterns;
    renderResult((data.result as ScanResult) ?? offline, remotePatterns);
  } finally {
    if (scanBtn) scanBtn.disabled = false;
  }
}

async function scanGithubRepo(raw: string): Promise<void> {
  const btn = document.getElementById("github-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  setGithubStatus("Checking GitHub target…");

  try {
    const { ok, data } = await apiGithub(raw.trim());
    const github =
      data.github && typeof data.github === "object"
        ? (data.github as Record<string, unknown>)
        : undefined;
    const patterns =
      data.patterns && typeof data.patterns === "object"
        ? (data.patterns as PatternReport)
        : undefined;

    if (!ok) {
      setGithubStatus(String(data.error ?? "GitHub scan failed"), true);
      if (github || patterns) {
        renderResult({}, patterns, github);
      }
      return;
    }

    const verified = github?.verified === true;
    const fullName =
      (github?.resolved as Record<string, unknown> | undefined)?.fullName ??
      (() => {
        const p = github?.parsed as Record<string, unknown> | undefined;
        return p?.owner && p?.repo ? `${String(p.owner)}/${String(p.repo)}` : "";
      })();

    setGithubStatus(
      verified
        ? `Verified ${String(fullName)}. Patterns ready.`
        : "GitHub responded but target did not verify.",
      !verified,
    );
    renderResult({}, patterns, github);
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById("scan")?.addEventListener("click", () => {
  scanActiveTab().catch((err: unknown) => {
    setStatus(err instanceof Error ? err.message : "Unexpected error", true);
  });
});

document.getElementById("github-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("github-url") as HTMLInputElement | null;
  const value = input?.value?.trim() ?? "";
  if (!value) {
    setGithubStatus("Paste a GitHub owner/repo URL.", true);
    return;
  }
  scanGithubRepo(value).catch((err: unknown) => {
    setGithubStatus(
      err instanceof Error ? err.message : "Unexpected error",
      true,
    );
  });
});

document.getElementById("login-btn")?.addEventListener("click", () => {
  chrome.tabs.create({ url: loginUrl() });
});

const privacy = document.getElementById("privacy-link") as HTMLAnchorElement | null;
if (privacy) privacy.href = privacyUrl();

const mainSite = document.getElementById("main-site") as HTMLAnchorElement | null;
if (mainSite) mainSite.href = mainSiteUrl();

apiQuota()
  .then(({ data }) => {
    if (data.quota && typeof data.quota === "object") {
      renderQuota(data.quota as Record<string, unknown>);
    } else {
      const el = document.getElementById("quota");
      if (el) el.textContent = "Quota loads after first scan";
    }
  })
  .catch(() => {
    const el = document.getElementById("quota");
    if (el) el.textContent = "Offline · local scan still works";
  });
