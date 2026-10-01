import {
  parseGithubRepoUrl,
  githubNamesMatch,
  type ParsedGithubRepo,
} from "@ai-detector/patterns";

export type { ParsedGithubRepo };

export type GithubAccess =
  | "public"
  | "private_with_token"
  | "not_found"
  | "rate_limited"
  | "error";

export interface GithubRepoResolved {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
  id: number;
  description: string | null;
}

export interface GithubScanPayload {
  repoFiles: string[];
  commits: Array<{
    message: string;
    author: string;
    coAuthors?: string[];
  }>;
  branches: string[];
  labels: string[];
  prBody?: string;
}

export interface GithubVerification {
  input: string;
  parsed: ParsedGithubRepo;
  resolved: GithubRepoResolved | null;
  /** True when GitHub returned the same owner/repo we asked for. */
  verified: boolean;
  access: GithubAccess;
  headSha: string | null;
  detail?: string;
}

export interface GithubFetchResult {
  ok: boolean;
  verification: GithubVerification;
  payload?: GithubScanPayload;
  error?: string;
  status: number;
}

export { parseGithubRepoUrl, githubNamesMatch };

function extractCoAuthors(message: string): string[] {
  const out: string[] = [];
  const re = /^co-authored-by:\s*(.+)$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    out.push(m[1]!.trim());
  }
  return out;
}

async function ghJson<T>(
  url: string,
  token: string | undefined,
): Promise<{ ok: boolean; status: number; data: T | null; message?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "algovortex-detect",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    const data = (await res.json().catch(() => null)) as T | null;
    if (!res.ok) {
      const message =
        data &&
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string"
          ? (data as { message: string }).message
          : `GitHub HTTP ${res.status}`;
      return { ok: false, status: res.status, data: null, message };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      message: err instanceof Error ? err.message : "GitHub fetch failed",
    };
  }
}

export async function fetchGithubForPatterns(
  rawUrl: string,
  options?: { token?: string; commitLimit?: number },
): Promise<GithubFetchResult> {
  const parsed = parseGithubRepoUrl(rawUrl);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error:
        "That does not look like a GitHub repo URL. Use https://github.com/owner/repo or owner/repo.",
      verification: {
        input: rawUrl,
        parsed: {
          owner: "",
          repo: "",
          htmlUrl: "",
          apiBase: "",
        },
        resolved: null,
        verified: false,
        access: "error",
        headSha: null,
        detail: "parse_failed",
      },
    };
  }

  const token = options?.token?.trim() || undefined;
  const commitLimit = Math.min(Math.max(options?.commitLimit ?? 40, 5), 100);

  const meta = await ghJson<{
    full_name: string;
    html_url: string;
    default_branch: string;
    private: boolean;
    id: number;
    description: string | null;
  }>(parsed.apiBase, token);

  if (!meta.ok || !meta.data) {
    const access: GithubAccess =
      meta.status === 404
        ? "not_found"
        : meta.status === 403 || meta.status === 429
          ? "rate_limited"
          : "error";
    return {
      ok: false,
      status: meta.status || 502,
      error:
        meta.status === 404
          ? `GitHub returned 404 for ${parsed.owner}/${parsed.repo}. Repo missing, renamed, or private — set GITHUB_TOKEN to scan private repos.`
          : meta.message ?? "Could not load that GitHub repo.",
      verification: {
        input: rawUrl,
        parsed,
        resolved: null,
        verified: false,
        access,
        headSha: null,
        detail: meta.message,
      },
    };
  }

  const resolved: GithubRepoResolved = {
    fullName: meta.data.full_name,
    htmlUrl: meta.data.html_url,
    defaultBranch: meta.data.default_branch,
    private: meta.data.private,
    id: meta.data.id,
    description: meta.data.description,
  };

  const verified = githubNamesMatch(parsed, resolved.fullName);
  if (!verified) {
    return {
      ok: false,
      status: 409,
      error: `GitHub resolved ${resolved.fullName}, which does not match requested ${parsed.owner}/${parsed.repo}.`,
      verification: {
        input: rawUrl,
        parsed,
        resolved,
        verified: false,
        access: resolved.private
          ? token
            ? "private_with_token"
            : "error"
          : "public",
        headSha: null,
        detail: "name_mismatch",
      },
    };
  }

  const access: GithubAccess = resolved.private
    ? token
      ? "private_with_token"
      : "error"
    : "public";

  const [treeRes, commitsRes, branchesRes] = await Promise.all([
    ghJson<{
      sha: string;
      tree: Array<{ path: string; type: string }>;
      truncated?: boolean;
    }>(
      `${parsed.apiBase}/git/trees/${encodeURIComponent(resolved.defaultBranch)}?recursive=1`,
      token,
    ),
    ghJson<
      Array<{
        sha: string;
        commit: {
          message: string;
          author?: { name?: string; email?: string } | null;
          committer?: { name?: string; email?: string } | null;
        };
        author?: { login?: string } | null;
      }>
    >(`${parsed.apiBase}/commits?per_page=${commitLimit}`, token),
    ghJson<Array<{ name: string }>>(
      `${parsed.apiBase}/branches?per_page=100`,
      token,
    ),
  ]);

  if (!treeRes.ok || !treeRes.data) {
    return {
      ok: false,
      status: treeRes.status || 502,
      error: treeRes.message ?? "Could not read repository tree.",
      verification: {
        input: rawUrl,
        parsed,
        resolved,
        verified: true,
        access,
        headSha: null,
        detail: treeRes.message,
      },
    };
  }

  const repoFiles = treeRes.data.tree
    .filter((t) => t.type === "blob" || t.type === "tree")
    .map((t) => t.path)
    .slice(0, 20_000);

  const commits =
    commitsRes.ok && commitsRes.data
      ? commitsRes.data.map((c) => {
          const message = c.commit?.message ?? "";
          const author =
            c.author?.login ||
            c.commit?.author?.name ||
            c.commit?.author?.email ||
            "unknown";
          return {
            message,
            author,
            coAuthors: extractCoAuthors(message),
          };
        })
      : [];

  const branches =
    branchesRes.ok && branchesRes.data
      ? branchesRes.data.map((b) => b.name)
      : [resolved.defaultBranch];

  return {
    ok: true,
    status: 200,
    verification: {
      input: rawUrl,
      parsed,
      resolved,
      verified: true,
      access: resolved.private ? "private_with_token" : "public",
      headSha: treeRes.data.sha,
      detail: treeRes.data.truncated ? "tree_truncated" : undefined,
    },
    payload: {
      repoFiles,
      commits,
      branches,
      labels: [],
    },
  };
}
