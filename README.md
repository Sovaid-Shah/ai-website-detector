# AlgoVortex Detect

Browser extension + web app that checks live pages for **AI site-builder fingerprints** (Lovable, Bolt, Base44, Replit, Framer platform, v0 preview) and **GitHub leftovers** (Cursor / Codex / Claude Code / Copilot markers).

It does **not** claim Cursor/Copilot authorship from a live website alone.

## Product host

- UI + API: `https://detect.algovortex.co` (Cloudflare Worker + assets)
- Main site (backlink target): `https://algovortex.co`

## Free stack

- Cloudflare Workers + D1 (`ai-detector`, id `4050daa2-32e2-4950-b76d-bceac8c52593`)
- Resend (already on `algovortex.co`)
- WXT extension (Chrome / Firefox / Edge)

## Monorepo

```
packages/rules      builder fingerprint engine
packages/patterns   paste / repo / git leftovers
packages/quota      URL + free/monthly limits
packages/db         D1 schema + QuotaRepository
apps/web            Hono API + static landing
apps/extension      WXT MV3 popup
```

## Setup

```bash
npm install pnpm@9.15.0 --no-save   # if pnpm missing globally
./node_modules/.bin/pnpm install
./node_modules/.bin/pnpm --filter @ai-detector/rules build
./node_modules/.bin/pnpm --filter @ai-detector/patterns build
./node_modules/.bin/pnpm --filter @ai-detector/quota build
./node_modules/.bin/pnpm --filter @ai-detector/db build
```

### D1 migrate (remote)

```bash
cd apps/web
pnpm exec wrangler login
pnpm run db:migrate:remote
```

### Secrets

```bash
cd apps/web
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put GITHUB_TOKEN   # private repo scans (e.g. AlgoVortex)
```

Optional local `.dev.vars`:

```
RESEND_API_KEY=re_xxx
MAGIC_LINK_FROM=noreply@algovortex.co
APP_ORIGIN=http://localhost:8787
SESSION_SECRET=dev-secret
GITHUB_TOKEN=
```

### Dev web

```bash
pnpm --filter @ai-detector/web dev
```

Open `http://localhost:8787`

### Dev extension

```bash
pnpm --filter @ai-detector/extension dev
```

Load unpacked from `.output/chrome-mv3` (WXT prints path).

## Extension store pack

```bash
pnpm --filter @ai-detector/patterns build
pnpm --filter @ai-detector/rules build
pnpm --filter @ai-detector/extension zip
# also: zip:firefox / zip:edge
```

Zip lands under `apps/extension/.output/`.

### Chrome Web Store listing (honest copy)

- **Name:** AlgoVortex Detect
- **Homepage:** https://algovortex.co
- **Privacy:** https://detect.algovortex.co/privacy.html
- **Summary:** Spot leftover fingerprints from AI site builders and GitHub AI-tool markers.
- **Say clearly:** Live pages almost never prove Cursor, Copilot, or ChatGPT wrote the code. We report technical leftovers only.

### Load / smoke test

1. Chrome → Extensions → Developer mode → Load unpacked → `apps/extension/.output/chrome-mv3`
2. Open a Lovable/Framer sample tab → Scan this tab
3. Uncheck “Enrich with server fetch” → confirm local-only works
4. Paste a public GitHub URL → confirm “Asked / returned / verified”
5. Footer links → algovortex.co + privacy

## DNS

1. Deploy: `pnpm --filter @ai-detector/web deploy`
2. Cloudflare Workers → custom domain `detect.algovortex.co`
3. Keep `@` / `www` pointing at Vercel for the main site

## Quota

- Anonymous: **3** unique registrable domains
- Signed in: **30** unique domains / UTC month
- Same domain rescan does not consume again
- GitHub pattern scan is separate from site quota (API only)

## Add a rule / pattern

**Builders:** `packages/rules/src/packs/` + test in `score.test.ts` + bump `RULES_VERSION`

**Leftovers:** `packages/patterns/src/packs/` + test in `engine.test.ts` / `github-url.test.ts` + bump `PATTERNS_VERSION`

## Non-goals (v1)

Separate `api.` host, Stripe, full dashboard, Safari store, vibe/style scoring, per-module authorship, fake statistical watermarks.
