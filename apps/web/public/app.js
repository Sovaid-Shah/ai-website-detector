const DEVICE_KEY = "av_detect_device_token";

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getStoredToken() {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  if (!token) return;
  try {
    localStorage.setItem(DEVICE_KEY, token);
  } catch {
    /* ignore */
  }
}

async function api(path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body ?? {}),
  });

  const data = await res.json().catch(() => ({}));
  if (data.deviceToken) storeToken(data.deviceToken);
  return { res, data };
}

function renderQuota(quota) {
  const el = document.getElementById("quota-line");
  if (!el || !quota) return;
  el.hidden = false;
  if (quota.isLoggedIn) {
    el.textContent = `Signed in · ${quota.monthlyRemaining} of ${quota.monthlyLimit} unique sites left this month`;
  } else {
    el.textContent = `${quota.remainingFree} of ${quota.freeLimit} free unique sites left`;
  }
}

function verdictTitle(verdict) {
  if (verdict === "likely_ai_builder") return "Likely AI site builder";
  if (verdict === "platform_only") return "Platform fingerprint only";
  return "Not enough signal";
}

function renderPatterns(patterns) {
  if (!patterns) return "";
  const rows = (patterns.matches || [])
    .map(
      (m) => `<li>
        <strong>${escapeText(m.humanLabel)}</strong>
        <span>${escapeText(m.tier)} · ${escapeText(m.tool)}</span>
        <code>${escapeText(m.evidence)}</code>
      </li>`,
    )
    .join("");
  return `
    <h4>Technical leftovers</h4>
    <p>${escapeText(patterns.summary || "")}</p>
    <ul class="evidence">${rows || "<li>No leftover patterns matched.</li>"}</ul>
    <p class="muted">${escapeText(patterns.statisticalNote || "")}</p>
  `;
}

function renderGithubVerification(github) {
  if (!github) return "";
  const parsed = github.parsed || {};
  const resolved = github.resolved;
  const asked = parsed.owner && parsed.repo ? `${parsed.owner}/${parsed.repo}` : "(unparsed)";
  const got = resolved?.fullName || "not resolved";
  const ok = github.verified === true;
  return `
    <h4>GitHub target check</h4>
    <p>
      Asked for <code>${escapeText(asked)}</code>
      · GitHub returned <code>${escapeText(got)}</code>
      · ${ok ? "match verified" : "NOT verified"}
    </p>
    <p class="muted">
      Access: ${escapeText(String(github.access || "unknown"))}
      ${resolved?.private ? " · private repo" : ""}
      ${resolved?.defaultBranch ? ` · default branch ${escapeText(resolved.defaultBranch)}` : ""}
      ${github.headSha ? ` · tree ${escapeText(String(github.headSha).slice(0, 12))}` : ""}
    </p>
    ${resolved?.htmlUrl ? `<p><a href="${escapeText(resolved.htmlUrl)}" target="_blank" rel="noopener">${escapeText(resolved.htmlUrl)}</a></p>` : ""}
  `;
}

function renderGithubResult(patterns, github) {
  const root = document.getElementById("github-result");
  if (!root) return;
  root.hidden = false;
  root.innerHTML = `
    ${renderGithubVerification(github)}
    ${renderPatterns(patterns)}
  `;
}

function renderResult(result, patterns) {
  const root = document.getElementById("result");
  if (!root) return;
  root.hidden = false;

  const chips = (result.detectedBuilders || [])
    .map((b) => `<span class="chip">${escapeText(b)}</span>`)
    .join("");

  const evidence = (result.signals || [])
    .map(
      (s) => `<li>
        <strong>${escapeText(s.humanLabel)}</strong>
        <span>${escapeText(s.strength)} · ${escapeText(s.builder)}</span>
        <code>${escapeText(s.evidence)}</code>
      </li>`,
    )
    .join("");

  root.innerHTML = `
    <h3>${escapeText(verdictTitle(result.verdict))}</h3>
    <p>${escapeText(result.summary)}</p>
    <p class="muted">Confidence ${escapeText(String(result.confidence))} · rules ${escapeText(result.rulesVersion)}</p>
    <div class="builders">${chips || '<span class="chip">none</span>'}</div>
    ${result.serverFetchFailed ? `<p class="status error">${escapeText(result.serverFetchFailed)}</p>` : ""}
    <ul class="evidence">${evidence || "<li>No fingerprint rows fired.</li>"}</ul>
    ${renderPatterns(patterns)}
    <p class="muted">${escapeText(result.limitsDisclaimer)}</p>
  `;
}

async function refreshQuota() {
  const token = getStoredToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch("/api/quota", { headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (data.deviceToken) storeToken(data.deviceToken);
  if (data.quota) renderQuota(data.quota);
}

const form = document.getElementById("scan-form");
const statusEl = document.getElementById("status");
const scanBtn = document.getElementById("scan-btn");

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = /** @type {HTMLInputElement} */ (document.getElementById("url")).value;
    statusEl.textContent = "Scanning…";
    statusEl.classList.remove("error");
    scanBtn.disabled = true;
    try {
      const { res, data } = await api("/api/scan", { url });
      if (data.quota) renderQuota(data.quota);
      if (!res.ok) {
        statusEl.textContent = data.error || "Scan failed.";
        statusEl.classList.add("error");
        if (data.requiresLogin) {
          statusEl.textContent += " Redirecting to sign in…";
          setTimeout(() => {
            window.location.href = "/login.html";
          }, 900);
        }
        return;
      }
      statusEl.textContent = "Done.";
      renderResult(data.result, data.patterns);
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : "Network error.";
      statusEl.classList.add("error");
    } finally {
      scanBtn.disabled = false;
    }
  });

  refreshQuota().catch(() => {
    /* first visit ok */
  });
}

const githubForm = document.getElementById("github-form");
const githubStatus = document.getElementById("github-status");
const githubBtn = document.getElementById("github-btn");

if (githubForm) {
  githubForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = /** @type {HTMLInputElement} */ (
      document.getElementById("github-url")
    ).value;
    githubStatus.textContent = "Checking GitHub target…";
    githubStatus.classList.remove("error");
    githubBtn.disabled = true;
    try {
      const { res, data } = await api("/api/github", { githubUrl: url });
      if (!res.ok) {
        githubStatus.textContent = data.error || "GitHub scan failed.";
        githubStatus.classList.add("error");
        if (data.github) {
          renderGithubResult(data.patterns, data.github);
        }
        return;
      }
      const verified = data.github?.verified === true;
      const fullName =
        data.github?.resolved?.fullName ||
        (data.github?.parsed?.owner
          ? `${data.github.parsed.owner}/${data.github.parsed.repo}`
          : "");
      githubStatus.textContent = verified
        ? `Verified ${fullName}. Patterns ready.`
        : "GitHub responded but target did not verify.";
      if (!verified) githubStatus.classList.add("error");
      renderGithubResult(data.patterns, data.github);
    } catch (err) {
      githubStatus.textContent =
        err instanceof Error ? err.message : "Network error.";
      githubStatus.classList.add("error");
    } finally {
      githubBtn.disabled = false;
    }
  });
}

export { api, storeToken, getStoredToken, escapeText };
