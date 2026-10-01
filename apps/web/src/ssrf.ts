import type { PageSnapshot } from "@ai-detector/rules";

const HTML_CAP = 200_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

function isBlockedIp(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".local")) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function safeFetchHtml(targetUrl: string): Promise<{
  ok: boolean;
  finalUrl?: string;
  html?: string;
  headers?: Record<string, string>;
  error?: string;
}> {
  let current = targetUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      return { ok: false, error: "Invalid URL during fetch." };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Blocked non-http(s) URL." };
    }
    if (isBlockedIp(parsed.hostname)) {
      return { ok: false, error: "Blocked private or local host." };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "AlgoVortexDetectBot/1.0 (+https://detect.algovortex.co; main https://algovortex.co; user-initiated scan)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, error: "Redirect without location." };
        current = new URL(loc, current).toString();
        continue;
      }

      if (!res.ok) {
        return {
          ok: false,
          error: `Remote site returned ${res.status}. You can still scan from the extension on the open tab.`,
        };
      }

      const text = await res.text();
      const html = text.slice(0, HTML_CAP);
      const headers: Record<string, string> = {};
      const server = res.headers.get("server");
      const powered = res.headers.get("x-powered-by");
      if (server) headers.server = server;
      if (powered) headers["x-powered-by"] = powered;

      return { ok: true, finalUrl: current, html, headers };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return { ok: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: "Too many redirects." };
}

export function snapshotFromHtml(
  url: string,
  html: string,
  headers?: Record<string, string>,
): PageSnapshot {
  const hostname = new URL(url).hostname.toLowerCase();
  const meta: Record<string, string> = {};
  const metaRe =
    /<meta\s+[^>]*?(?:name|property)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
  const metaRe2 =
    /<meta\s+[^>]*?content\s*=\s*["']([^"']*)["'][^>]*?(?:name|property)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) {
    meta[m[1]!.toLowerCase()] = m[2]!;
  }
  while ((m = metaRe2.exec(html))) {
    meta[m[2]!.toLowerCase()] = m[1]!;
  }

  const scriptSrcs: string[] = [];
  const scriptRe = /<script[^>]+src=["']([^"']+)["']/gi;
  while ((m = scriptRe.exec(html))) scriptSrcs.push(m[1]!);

  const linkHrefs: string[] = [];
  const linkRe = /<link[^>]+href=["']([^"']+)["']/gi;
  while ((m = linkRe.exec(html))) linkHrefs.push(m[1]!);

  const matchedSelectors: string[] = [];
  if (/id=["']lovable-badge["']/i.test(html)) matchedSelectors.push("#lovable-badge");
  if (/id=["']__framer-badge-container["']/i.test(html)) {
    matchedSelectors.push("#__framer-badge-container");
  }

  return {
    url,
    hostname,
    meta,
    scriptSrcs,
    linkHrefs,
    resourceUrls: [...scriptSrcs, ...linkHrefs],
    htmlExcerpt: html.slice(0, 80_000),
    matchedSelectors,
    headers,
  };
}
