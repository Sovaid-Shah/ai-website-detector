export interface ParsedGithubRepo {
  owner: string;
  repo: string;
  htmlUrl: string;
  apiBase: string;
}

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/**
 * Accepts:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - owner/repo
 */
export function parseGithubRepoUrl(raw: string): ParsedGithubRepo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ssh = trimmed.match(
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i,
  );
  if (ssh) {
    const owner = ssh[1]!;
    const repo = ssh[2]!.replace(/\.git$/i, "");
    return {
      owner,
      repo,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      apiBase: `https://api.github.com/repos/${owner}/${repo}`,
    };
  }

  const short = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  if (short && !trimmed.includes("://") && !trimmed.includes("@")) {
    const owner = short[1]!;
    const repo = short[2]!.replace(/\.git$/i, "");
    if (owner === "." || owner === "..") return null;
    return {
      owner,
      repo,
      htmlUrl: `https://github.com/${owner}/${repo}`,
      apiBase: `https://api.github.com/repos/${owner}/${repo}`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/i, "");
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    htmlUrl: `https://github.com/${owner}/${repo}`,
    apiBase: `https://api.github.com/repos/${owner}/${repo}`,
  };
}

export function githubNamesMatch(
  parsed: ParsedGithubRepo,
  fullName: string,
): boolean {
  return (
    fullName.toLowerCase() ===
    `${parsed.owner}/${parsed.repo}`.toLowerCase()
  );
}
