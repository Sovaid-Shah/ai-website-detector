import type { PageSnapshot } from "@ai-detector/rules";

const SELECTORS = ["#lovable-badge", "[data-lovable-badge]", "#__framer-badge-container"];

export function collectPageSnapshot(): PageSnapshot {
  const meta: Record<string, string> = {};
  document.querySelectorAll("meta[name], meta[property]").forEach((node) => {
    const el = node as HTMLMetaElement;
    const key = (el.getAttribute("name") || el.getAttribute("property") || "").toLowerCase();
    const content = el.getAttribute("content");
    if (key && content) meta[key] = content;
  });

  const scriptSrcs = [...document.scripts]
    .map((s) => s.src)
    .filter(Boolean);

  const linkHrefs = [...document.querySelectorAll("link[href]")]
    .map((l) => (l as HTMLLinkElement).href)
    .filter(Boolean);

  const matchedSelectors = SELECTORS.filter((sel) => document.querySelector(sel));

  let resourceUrls: string[] = [];
  try {
    resourceUrls = performance
      .getEntriesByType("resource")
      .map((e) => (e as PerformanceResourceTiming).name)
      .slice(0, 200);
  } catch {
    resourceUrls = [];
  }

  const htmlExcerpt = document.documentElement.outerHTML.slice(0, 80_000);

  return {
    url: location.href,
    hostname: location.hostname,
    meta,
    scriptSrcs,
    linkHrefs,
    resourceUrls,
    htmlExcerpt,
    matchedSelectors,
  };
}
