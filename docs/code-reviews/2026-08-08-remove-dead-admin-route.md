# 2026-08-08 — Remove the dead `/admin` route, SWA OIDC block and Decap copy

**Card:** universaltill/ut-docs#471
**Branch:** `feat/astro-decap-cms-migration` (PR #4, continued)
**Model routing:** complexity:easy — built inline (Sonnet, this session), reviewed by a
fresh-context Sonnet subagent (no prior context on this diff).

## Why

Follow-up to ut-docs#461: the Decap CMS admin now runs at
`https://admin.universaltill.com` (homelab cluster, oauth2-proxy + Zitadel), not
on this Static Web App. `ut-website`'s branch still carried a second, now-dead
copy of the admin (`site/admin/`) plus a `staticwebapp.config.json` `auth`
block pointing at a Zitadel redirect URI that no longer exists. Left as-is,
merging PR #4 would have shipped an `/admin` whose only login path 404s into a
dead OIDC exchange instead of the site cleanly not having the page at all.

## What changed

- Deleted `site/admin/index.html` — the duplicate Decap config. The single
  remaining copy of the Decap admin config is the `ut-admin` ConfigMap in
  `homelab-k8s`.
- `site/staticwebapp.config.json`: removed the `/admin`/`/admin/*` route
  entries, the `responseOverrides.401` Zitadel redirect, and the entire `auth`
  block. **Kept** (and added) `/admin` + `/admin/*` in
  `navigationFallback.exclude` — Azure SWA's `navigationFallback` rewrites any
  unmatched path to `/index.html` with a 200 unless it's excluded, so removing
  the exclude entry would have silently served the homepage at `/admin/`
  instead of a clean 404 (the exact trap ut-docs#461's investigation hit
  repeatedly and this issue explicitly warned about).
- `README.md` / `docs/astro-migration.md`: corrected to describe the current
  architecture (admin on the cluster, not this SWA) instead of the original,
  no-longer-true 2026-07-28 plan. `astro-migration.md` keeps the original plan
  text below a dated update note rather than deleting it, since it's still an
  accurate record of what was tried and why it didn't work (SWA Free doesn't
  support custom OIDC providers).
- `src/content/blog/blog-is-live.mdx`: fixed a placeholder blog post that told
  readers to edit it from `/admin` — that path now 404s by design, so the
  live post was pointed at `admin.universaltill.com` instead (found by
  review, see below).
- **Untouched, deliberately:** `api/auth`, `api/callback` — Decap's GitHub
  OAuth relay stays on this SWA for now; porting it same-origin to the
  cluster host is ut-docs#468, a separate card. Deleting these here would
  have thrown away real XSS/CSRF/scope hardening with nothing yet in place
  to replace it.

## Verification

- `npm ci && npm run build` succeeds (Node 22).
- The repo's own CI regression check (`.github/workflows/ci.yml`'s `build`
  job: every file under `site/` must appear byte-identical under the
  matching `dist/` path) run locally — passes. `find dist -iname "*admin*"`
  is empty.
- `node scripts/check-i18n-keys.js` — OK, 4 locales/167 keys, unaffected.
- `bash scripts/check-brand-assets.sh` — passes.
- `node --test api/auth.test.js` — 5/5 pass, confirming the untouched OAuth
  relay's CSRF/XSS/scope hardening is intact.
- `staticwebapp.config.json` re-validated as parseable JSON.

## Independent review (fresh-context Sonnet subagent)

No BLOCKER/MAJOR findings. All four of #471's acceptance criteria verified
independently against the actual file contents (not the diff description) —
specifically re-checked that `/admin`/`/admin/*` stayed in
`navigationFallback.exclude` rather than assuming removal-from-routes alone
was sufficient for AC1.

Two MINOR findings:
1. The placeholder blog post still linked `/admin` — **fixed** in this
   branch (see above).
2. Stale "same origin as `/admin`" comments in `api/auth.test.js`,
   `api/callback/index.js`, `.github/workflows/ci.yml`, and
   `astro.config.mjs` — pre-existing, out of scope for this card (touching
   `api/*`/CI here was explicitly not part of #471), and these files are
   already slated to change when ut-docs#468 ports the relay in-cluster.
   Left as a note for that card rather than fixed here.

## Result

Merged into the existing `feat/astro-decap-cms-migration` branch (PR #4).
`https://www.universaltill.com/admin/` will 404 cleanly once deployed; the
public marketing site is unchanged; the Decap admin's only home is now
`admin.universaltill.com`.
