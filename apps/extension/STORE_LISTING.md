# Chrome Web Store listing draft

## Short description (132 char max)

Find AI site-builder fingerprints and GitHub leftovers. Honest about what Cursor and Copilot leave on a live page.

## Detailed description

AlgoVortex Detect checks the page you have open for leftover fingerprints from AI site builders (Lovable, Bolt, Base44, Replit, Framer platform signals, v0 preview hosts).

It can also scan a public GitHub repo for technical leftovers from Cursor, Codex, Claude Code, and Copilot (commit trailers, .cursor rules, skills-lock, bot authors). We verify the owner/repo GitHub returns matches what you typed.

What this does not do: it will not claim a normal React site was “made with Cursor” from the live HTML alone. Most IDE and chat tools leave no public watermark on production sites. If we do not find strong leftovers, we say so.

Detect is a free product from AlgoVortex.

- Main site: https://algovortex.co
- Privacy: https://detect.algovortex.co/privacy.html
- Web scanner: https://detect.algovortex.co

Permissions: active tab + scripting only when you click Scan; storage for device quota token; host access only to detect.algovortex.co for optional server enrich and GitHub pattern API.

## Graphic assets (ready to upload)

Folder: `apps/extension/store-assets/`

| CWS field | File | Size |
|-----------|------|------|
| Store icon (required) | `store-icon-128.png` | 128×128 RGB |
| Screenshots (required, use JPG safer) | `screenshot-1-tab-scan-1280x800.jpg` | 1280×800 |
| Screenshots | `screenshot-2-github-1280x800.jpg` | 1280×800 |
| Small promo (optional) | `promo-small-440x280.png` | 440×280 |
| Marquee promo (optional) | `promo-marquee-1400x560.png` | 1400×560 |

Skip promo video unless you have a YouTube URL.

## Fix “Unable to publish” blockers

### A) Account Settings (2 items)

1. Open **Account → Settings** (publisher settings, not item).
2. Set **Contact email** (use `sovaids@gmail.com` or a monitored AlgoVortex inbox).
3. Click verify link in email. Wait until status shows verified.

### B) Item → Privacy practices (paste these)

**Single purpose description**

```
Detect technical leftovers that suggest a site used an AI site builder (for example Lovable, Bolt, Base44, Replit, Framer, or v0) or that a public GitHub repo contains Cursor, Codex, Claude Code, or Copilot markers. The extension only runs when the user clicks Scan. It does not rewrite pages, inject ads, or track browsing history.
```

**activeTab justification**

```
Used only when the user clicks “Scan this tab” so we can read the active tab URL and run a one-time content script on that tab to collect public page fingerprints (meta tags, script URLs, HTML excerpt). We do not access tabs in the background.
```

**scripting justification**

```
Used with activeTab to inject a short collector function into the current tab after the user clicks Scan. The script gathers publicly visible page signals for local scoring, then returns the result to the popup. No persistent content scripts.
```

**storage justification**

```
chrome.storage.local stores a device quota token so free-tier unique-site limits can continue across popup opens. No browsing history or page HTML is stored in extension storage.
```

**Host permission justification** (`https://detect.algovortex.co/*`)

```
Optional server enrich and GitHub pattern API for AlgoVortex Detect. After a user-initiated scan, the extension may POST page fingerprints or a GitHub repo URL to https://detect.algovortex.co so the user gets quota accounting and the same pattern report as the website. No other hosts.
```

**Remote code justification**

```
This extension does not execute remote code. All detection logic ships inside the extension package. Network calls to https://detect.algovortex.co return JSON only (scan results / quota). We do not fetch or eval remote JavaScript.
```

On the remote-code question, choose **No** if the form asks whether you use remote code. If a text box still appears, paste the justification above.

**Data usage certification**

Check the certification box that your data use complies with Chrome Web Store Developer Program Policies.

Privacy policy URL (if asked again): `https://detect.algovortex.co/privacy.html`

### C) Re-upload package (recommended)

Production zip no longer includes `localhost` host permission.

```bash
pnpm --filter @ai-detector/extension zip
```

Upload: `apps/extension/.output/ai-detectorextension-0.1.0-chrome.zip`

Then **Save draft** → submit again.


