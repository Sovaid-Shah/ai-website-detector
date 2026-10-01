import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { scoreSnapshot, type PageSnapshot, type ScanResult } from "@ai-detector/rules";
import {
  runPatterns,
  runPatternSurfaces,
  parseGithubRepoUrl,
  type PatternReport,
} from "@ai-detector/patterns";
import { normalizeScanUrl } from "@ai-detector/quota";
import { QuotaRepository, hashSoftBind } from "@ai-detector/db";
import { safeFetchHtml, snapshotFromHtml } from "./ssrf";
import { fetchGithubForPatterns } from "./github";

type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  RESEND_API_KEY?: string;
  MAGIC_LINK_FROM: string;
  APP_ORIGIN: string;
  SESSION_SECRET?: string;
  GITHUB_TOKEN?: string;
};

const DEVICE_COOKIE = "av_detect_device";
const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const origin = c.req.header("Origin");
  const allow = new Set([
    c.env.APP_ORIGIN,
    "http://localhost:8787",
    "http://127.0.0.1:8787",
  ]);
  const corsMw = cors({
    origin: (o) => {
      if (!o) return c.env.APP_ORIGIN;
      if (allow.has(o)) return o;
      if (o.startsWith("chrome-extension://") || o.startsWith("moz-extension://")) {
        return o;
      }
      return "";
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
  });
  // silence unused
  void origin;
  return corsMw(c, next);
});

function bearerToken(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const h = c.req.header("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

async function resolveDevice(c: {
  env: Env;
  req: { header: (n: string) => string | undefined };
}): Promise<{ repo: QuotaRepository; deviceId: string; token: string }> {
  const repo = new QuotaRepository(c.env.DB);
  const fromHeader = bearerToken(c);
  const fromCookie = getCookie(c as never, DEVICE_COOKIE) ?? null;
  const boot = await repo.bootstrapDevice(fromHeader ?? fromCookie);
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for") ?? "0.0.0.0";
  const ua = c.req.header("User-Agent") ?? "unknown";
  const bind = await hashSoftBind(ip.split(",")[0]!.trim(), ua);
  await repo.softBind(boot.deviceId, bind);
  return { repo, deviceId: boot.deviceId, token: boot.token };
}

function attachDeviceCookie(
  c: { env: Env },
  setCookieFn: typeof setCookie,
  token: string,
): void {
  setCookieFn(c as never, DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

function quotaPayload(q: Awaited<ReturnType<QuotaRepository["getQuota"]>>) {
  return {
    remainingFree: q.remainingFree,
    freeLimit: q.freeLimit,
    usedHosts: q.usedHosts,
    requiresLogin: q.requiresLogin,
    monthlyRemaining: q.monthlyRemaining,
    monthlyLimit: q.monthlyLimit,
    isLoggedIn: q.isLoggedIn,
  };
}

app.post("/api/device/bootstrap", async (c) => {
  try {
    const { repo, deviceId, token } = await resolveDevice(c);
    attachDeviceCookie(c, setCookie, token);
    const quota = await repo.getQuota(deviceId);
    return c.json({ deviceToken: token, quota: quotaPayload(quota) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bootstrap failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/scan", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      url?: string;
      snapshot?: PageSnapshot;
    };

    const { repo, deviceId, token } = await resolveDevice(c);
    attachDeviceCookie(c, setCookie, token);

    if (!body.url && !body.snapshot?.url) {
      return c.json({ error: "Provide a url or snapshot." }, 400);
    }

    const rawUrl = body.url ?? body.snapshot!.url;
    const normalized = normalizeScanUrl(rawUrl);
    if (!normalized.ok) {
      return c.json({ error: normalized.error }, 400);
    }

    const credit = await repo.creditHost(deviceId, normalized.registrableDomain);
    if (!credit.allowed) {
      return c.json(
        {
          error: credit.quota.isLoggedIn
            ? "Monthly scan limit reached. Pro plans come later."
            : "Free scans used up. Sign in to continue.",
          requiresLogin: !credit.quota.isLoggedIn,
          quota: quotaPayload(credit.quota),
        },
        401,
      );
    }

    let snapshot: PageSnapshot;
    let serverFetchFailed: string | undefined;

    if (body.snapshot) {
      snapshot = {
        ...body.snapshot,
        url: normalized.href,
        hostname: normalized.hostname,
      };
      const fetched = await safeFetchHtml(normalized.href);
      if (fetched.ok && fetched.html) {
        const serverSnap = snapshotFromHtml(
          fetched.finalUrl ?? normalized.href,
          fetched.html,
          fetched.headers,
        );
        snapshot = {
          ...snapshot,
          meta: { ...serverSnap.meta, ...snapshot.meta },
          scriptSrcs: [...new Set([...serverSnap.scriptSrcs, ...snapshot.scriptSrcs])],
          linkHrefs: [...new Set([...serverSnap.linkHrefs, ...snapshot.linkHrefs])],
          resourceUrls: [
            ...new Set([...serverSnap.resourceUrls, ...snapshot.resourceUrls]),
          ],
          matchedSelectors: [
            ...new Set([
              ...serverSnap.matchedSelectors,
              ...snapshot.matchedSelectors,
            ]),
          ],
          htmlExcerpt: `${serverSnap.htmlExcerpt}\n${snapshot.htmlExcerpt}`.slice(
            0,
            120_000,
          ),
          headers: { ...(serverSnap.headers ?? {}), ...(snapshot.headers ?? {}) },
        };
      } else if (fetched.error) {
        serverFetchFailed = fetched.error;
      }
    } else {
      const fetched = await safeFetchHtml(normalized.href);
      if (!fetched.ok || !fetched.html) {
        return c.json(
          {
            error: fetched.error ?? "Could not fetch that page.",
            quota: quotaPayload(credit.quota),
          },
          422,
        );
      }
      snapshot = snapshotFromHtml(
        fetched.finalUrl ?? normalized.href,
        fetched.html,
        fetched.headers,
      );
    }

    const scored: ScanResult = scoreSnapshot(snapshot);
    scored.quota = quotaPayload(credit.quota);
    if (serverFetchFailed) scored.serverFetchFailed = serverFetchFailed;

    let patterns: PatternReport;
    try {
      patterns = runPatterns({
        surface: "live_html",
        url: snapshot.url,
        html: snapshot.htmlExcerpt,
        text: snapshot.htmlExcerpt,
      });
    } catch {
      patterns = runPatterns({ surface: "live_html", html: "" });
    }

    return c.json({
      result: scored,
      patterns,
      deviceToken: token,
      quota: quotaPayload(credit.quota),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/patterns", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      surface?: string;
      html?: string;
      text?: string;
      url?: string;
      githubUrl?: string;
      repoFiles?: string[];
      commits?: Array<{ message: string; author: string; coAuthors?: string[] }>;
      branches?: string[];
      prBody?: string;
      labels?: string[];
      includeWeakStyle?: boolean;
    };

    const githubInput = body.githubUrl ?? body.url;
    if (githubInput && parseGithubRepoUrl(githubInput)) {
      const fetched = await fetchGithubForPatterns(githubInput, {
        token: c.env.GITHUB_TOKEN,
      });
      if (!fetched.ok || !fetched.payload) {
        return c.json(
          {
            error: fetched.error ?? "GitHub scan failed",
            github: fetched.verification,
          },
          fetched.status >= 400 && fetched.status < 600
            ? (fetched.status as 400 | 401 | 403 | 404 | 409 | 429 | 502)
            : 502,
        );
      }

      const patterns = runPatternSurfaces(
        {
          url: fetched.verification.resolved?.htmlUrl ?? fetched.verification.parsed.htmlUrl,
          repoFiles: fetched.payload.repoFiles,
          commits: fetched.payload.commits,
          branches: fetched.payload.branches,
          labels: fetched.payload.labels,
          prBody: fetched.payload.prBody,
        },
        ["repo_tree", "git_meta"],
        { includeWeakStyle: body.includeWeakStyle === true },
      );

      return c.json({
        patterns,
        github: fetched.verification,
      });
    }

    const allowed = new Set([
      "live_html",
      "paste_html",
      "paste_text",
      "repo_tree",
      "git_meta",
    ]);
    const surface = allowed.has(body.surface ?? "")
      ? (body.surface as
          | "live_html"
          | "paste_html"
          | "paste_text"
          | "repo_tree"
          | "git_meta")
      : body.html
        ? "paste_html"
        : body.repoFiles
          ? "repo_tree"
          : body.commits || body.branches
            ? "git_meta"
            : "paste_text";

    const report = runPatterns(
      {
        surface,
        url: body.url,
        html: body.html,
        text: body.text,
        repoFiles: body.repoFiles,
        commits: body.commits,
        branches: body.branches,
        prBody: body.prBody,
        labels: body.labels,
      },
      { includeWeakStyle: body.includeWeakStyle === true },
    );

    return c.json({ patterns: report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pattern check failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/github", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      url?: string;
      githubUrl?: string;
      includeWeakStyle?: boolean;
    };
    const input = (body.githubUrl ?? body.url ?? "").trim();
    if (!input) {
      return c.json({ error: "Provide a githubUrl." }, 400);
    }

    const fetched = await fetchGithubForPatterns(input, {
      token: c.env.GITHUB_TOKEN,
    });
    if (!fetched.ok || !fetched.payload) {
      return c.json(
        {
          error: fetched.error ?? "GitHub scan failed",
          github: fetched.verification,
        },
        fetched.status >= 400 && fetched.status < 600
          ? (fetched.status as 400 | 401 | 403 | 404 | 409 | 429 | 502)
          : 502,
      );
    }

    const patterns = runPatternSurfaces(
      {
        url: fetched.verification.resolved?.htmlUrl ?? fetched.verification.parsed.htmlUrl,
        repoFiles: fetched.payload.repoFiles,
        commits: fetched.payload.commits,
        branches: fetched.payload.branches,
        labels: fetched.payload.labels,
        prBody: fetched.payload.prBody,
      },
      ["repo_tree", "git_meta"],
      { includeWeakStyle: body.includeWeakStyle === true },
    );

    return c.json({
      patterns,
      github: fetched.verification,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub scan failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/auth/request", async (c) => {
  try {
    const body = (await c.req.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "Enter a valid email." }, 400);
    }

    const { repo, deviceId, token } = await resolveDevice(c);
    attachDeviceCookie(c, setCookie, token);
    const magic = await repo.createMagicLink(email, deviceId);
    const link = `${c.env.APP_ORIGIN}/login/callback.html?token=${magic}`;

    if (!c.env.RESEND_API_KEY) {
      return c.json({
        ok: true,
        devLink: link,
        message: "RESEND_API_KEY missing. Use devLink in local/dev only.",
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: c.env.MAGIC_LINK_FROM,
        to: [email],
        subject: "Your AlgoVortex Detect sign-in link",
        html: `<p>Click to sign in to AlgoVortex Detect:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes. If you did not ask for it, ignore this email.</p>`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: `Email send failed: ${text}` }, 502);
    }

    return c.json({ ok: true, message: "Check your email for the sign-in link." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth request failed";
    return c.json({ error: message }, 500);
  }
});

app.post("/api/auth/verify", async (c) => {
  try {
    const body = (await c.req.json()) as { token?: string };
    if (!body.token) return c.json({ error: "Missing token." }, 400);
    const repo = new QuotaRepository(c.env.DB);
    const consumed = await repo.consumeMagicLink(body.token);
    if (!consumed) return c.json({ error: "Link invalid or expired." }, 400);

    let deviceToken = getCookie(c as never, DEVICE_COOKIE) ?? null;
    if (!deviceToken && consumed.deviceId) {
      // device already linked in DB via consume
    }
    const boot = await repo.bootstrapDevice(deviceToken);
    if (consumed.deviceId && boot.deviceId !== consumed.deviceId) {
      // prefer linked device from magic link path already updated
    }
    attachDeviceCookie(c, setCookie, boot.token);
    const quota = await repo.getQuota(consumed.deviceId ?? boot.deviceId);
    return c.json({
      ok: true,
      email: consumed.email,
      deviceToken: boot.token,
      quota: quotaPayload(quota),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verify failed";
    return c.json({ error: message }, 500);
  }
});

app.get("/api/quota", async (c) => {
  try {
    const { repo, deviceId, token } = await resolveDevice(c);
    attachDeviceCookie(c, setCookie, token);
    const quota = await repo.getQuota(deviceId);
    return c.json({ deviceToken: token, quota: quotaPayload(quota) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quota failed";
    return c.json({ error: message }, 500);
  }
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
