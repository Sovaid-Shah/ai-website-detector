const API_BASE =
  import.meta.env.MODE === "production"
    ? "https://detect.algovortex.co"
    : "http://localhost:8787";

const DEVICE_KEY = "av_detect_device_token";

export function apiBase(): string {
  return API_BASE;
}

export async function getDeviceToken(): Promise<string | null> {
  const data = await chrome.storage.local.get(DEVICE_KEY);
  return (data[DEVICE_KEY] as string | undefined) ?? null;
}

export async function setDeviceToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [DEVICE_KEY]: token });
}

async function apiPost(
  path: string,
  body: unknown,
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  const token = await getDeviceToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (typeof data.deviceToken === "string") {
      await setDeviceToken(data.deviceToken);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {
        error: err instanceof Error ? err.message : "Network error",
        offline: true,
      },
    };
  }
}

export async function apiScan(body: unknown): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  return apiPost("/api/scan", body);
}

export async function apiGithub(githubUrl: string): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  return apiPost("/api/github", { githubUrl });
}

export async function apiQuota(): Promise<{
  ok: boolean;
  data: Record<string, unknown>;
}> {
  const token = await getDeviceToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE}/api/quota`, {
      headers,
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (typeof data.deviceToken === "string") {
      await setDeviceToken(data.deviceToken);
    }
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: {} };
  }
}

export function loginUrl(): string {
  return `${API_BASE}/login.html`;
}

export function privacyUrl(): string {
  return `${API_BASE}/privacy.html`;
}

export function mainSiteUrl(): string {
  return "https://algovortex.co";
}
