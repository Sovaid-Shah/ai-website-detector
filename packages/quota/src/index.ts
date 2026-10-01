import { parse } from "tldts";

export const FREE_UNIQUE_SITES = 3;
export const LOGGED_IN_MONTHLY_UNIQUE = 30;

export type UrlCheckResult =
  | { ok: true; href: string; hostname: string; registrableDomain: string }
  | { ok: false; error: string };

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function normalizeScanUrl(input: string): UrlCheckResult {
  let raw = input.trim();
  if (!raw) return { ok: false, error: "URL is empty." };
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That does not look like a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs can be scanned." };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local")) {
    return { ok: false, error: "Local or private addresses cannot be scanned." };
  }
  if (isPrivateIpv4(hostname) || hostname.includes(":")) {
    return { ok: false, error: "Private or link-local addresses cannot be scanned." };
  }

  const parsed = parse(hostname, { allowPrivateDomains: true });
  const registrable = (parsed.domain ?? hostname).toLowerCase();
  if (!registrable) {
    return { ok: false, error: "Could not normalize that domain." };
  }

  return {
    ok: true,
    href: url.toString(),
    hostname,
    registrableDomain: registrable,
  };
}

export function monthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
