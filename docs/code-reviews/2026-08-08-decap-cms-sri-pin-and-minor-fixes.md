# 2026-08-08 — Decap CMS: pin + SRI, and its five MINOR follow-ups (PR #4)

**Card:** universaltill/ut-docs#354
**PR:** universaltill/ut-website#4 — branch `feat/astro-decap-cms-migration`
(commit landed on the existing, still-unmerged branch; see "Why this
didn't get its own PR" below)
**Outcome: fixed, independently reviewed, all gates green. Not merged —
merging the branch is tracked separately by ut-docs#355 (`blocked:env`:
needs live Azure app settings + a hand-created GitHub OAuth App, neither
obtainable from a cold cloud session). That gate is unrelated to this
fix and was already open before this cycle.**

## Why this didn't get its own PR

The vulnerable file (`site/admin/index.html`) only exists on PR #4's
branch — it was never on `main` (Astro/Decap CMS have not shipped yet).
ut-docs#354 was itself opened as a finding from PR #4's own 2026-08-06
review (`docs/code-reviews/2026-08-06-astro-decap-cms-migration.md`), so
the fix belongs on that same branch, same as any other review-finding
follow-up would.

## What was wrong (recap)

`site/admin/index.html` loaded Decap CMS from `unpkg.com` on a floating
`decap-cms@^3.0.0` range, no Subresource Integrity, no `crossorigin`. This
is the page that holds a GitHub access token in `localStorage` — any new
3.x publish (a hijacked npm account, a compromised unpkg edge) would
execute unreviewed on `www.universaltill.com` with that token in reach.

## Fix

| Finding | Fix |
|---|---|
| **Floating range, no SRI (the BLOCKER)** | Pinned to exact `decap-cms@3.15.1`; added `integrity="sha384-…"` + `crossorigin="anonymous"` on the `<script>` tag. Hash independently verified twice (by this fix and again by the reviewer) directly against the npm registry tarball — `unpkg.com` itself is blocked by this environment's egress policy, so verification went registry→tarball→`openssl dgst -sha384`, not a live fetch of the CDN URL. |
| **Bonus find, not in the original ticket: the `<link rel="stylesheet" href=".../decap-cms.css">` was dead on arrival** | decap-cms.js's own package has never shipped `dist/decap-cms.css` for any 3.x release (checked 3.0.0 and 3.15.1 directly) — CSS has been CSS-in-JS, injected by `decap-cms.js` itself, since Decap 2.0. The package ships only a near-empty `dist/cms.css` back-compat shim (277 bytes, a comment explaining exactly this). The `<link>` has been silently 404ing since this PR was opened. Removed it; no styling is lost. |
| `local_backend: true` shipped to production | Removed. |
| Saves commit straight to `main` (the deploy trigger, no review) | Added `"publish_mode": "editorial_workflow"` — CMS saves now open PRs. |
| No explicit `format` on the blog collection | Added `"format": "frontmatter"`, matching the existing `---`-delimited YAML in `src/content/blog/blog-is-live.mdx`. |
| `coverImage` authored in the CMS but never rendered | `src/pages/blog/index.astro` and `src/pages/blog/[slug].astro` now render it as an `<img>` when present (both `&&`-guarded, so drafts/no-cover posts are unaffected); `alt` uses the post title rather than an empty string, since a cover image is real editorial content, not decoration. |
| `/plugins` missing from `navigationFallback.exclude` | Added `"/plugins/*"`, matching the existing `/blog/*` precedent (a bare `/plugins` entry was also added in an earlier pass of this fix and then removed as redundant — the real static file at `/plugins/index.html` is served before the fallback/exclude logic is ever consulted, same mechanism the pre-existing `/blog/*` entry already relies on). |
| No CSP in `globalHeaders` | **Explicitly declined here** — see "CSP: explicit decline" below. Not silently skipped. |

### CSP: explicit decline, with reason

The issue's own text already flagged this as needing its own pass:
adding a `Content-Security-Policy` is real defence-in-depth for `/admin`,
but `globalHeaders` in `staticwebapp.config.json` applies to **every**
existing marketing page (`/`, `/tr`, `/zh`, `/fa`, `/download`, `/start`,
`/store`, `/language`), most of which load third-party assets (fonts,
the Zitadel auth redirect, potentially analytics) that a naive default-src
policy would break silently, with no way to visually verify the result
from this environment (no browser). Recorded here as this fix's explicit
decline, per the issue's own acceptance criterion ("each MINOR is fixed
or explicitly declined with a reason") — tracked as a new follow-up card,
universaltill/ut-docs#442, scoped as its own careful, page-by-page pass.

## Independent review

Performed by a fresh-context Sonnet subagent (per this card's
`complexity:easy` routing) with no part in writing the fix. It did not
take the diff's claims on faith — independently re-derived the SRI hash
from the raw npm tarball (two different tools, same result), confirmed
`decap-cms.css` has genuinely never existed in any 3.x release rather than
trusting the claim, re-ran every gate itself with pasted output, and
checked `git status` for stray changes (found and reverted: `npm install`
had touched `package-lock.json` with unrelated dependency-graph metadata
churn — reverted before commit, not part of this diff).

Verdict: **SHIP WITH MINOR FOLLOW-UPS.** One should-fix (the CSP decline
had no trace in the repo — now fixed by this record existing) and two
nits, both applied:
- SRI covers only the entry file; `decap-cms.js` webpack-splits into ~90
  chunks loaded from the same pinned/immutable npm version with no
  per-chunk SRI (mitigated by npm tarball immutability, not eliminated —
  documented as a caveat in the code comment rather than treated as
  unresolved, since full chunk-level SRI would mean vendoring, which the
  original issue only offered as the "preferred", not required, option).
- The redundant bare `/plugins` exclude entry — removed, kept only
  `/plugins/*` to match the `/blog/*` precedent.

## Verification performed

- `openssl dgst -sha384` (and, in the reviewer's independent pass, Node's
  `crypto.createHash('sha384')`) against `decap-cms@3.15.1`'s real npm
  tarball — both match the committed `integrity` value exactly.
- `find <tarball>/package/dist -iname "*.css"` on both `3.0.0` and
  `3.15.1` — `decap-cms.css` absent in both; only `cms.css` (the
  documented compat shim) exists.
- `node -e "JSON.parse(...)"` on the `decap-cms-config` script block and
  on `staticwebapp.config.json` — both valid.
- `npm run build` — clean; generates `dist/admin/index.html`,
  `dist/blog/index.html`, `dist/blog/blog-is-live/index.html`,
  `dist/plugins/index.html`.
- `diff site/admin/index.html dist/admin/index.html` — byte-identical
  (confirms the `publicDir` pass-through this repo's own CI job guards).
- `node scripts/check-i18n-keys.js` → OK (4 locales, 167 keys, 5 pages).
- `bash scripts/check-brand-assets.sh` → clean.
- `node --test api/auth.test.js` → 5/5 pass (unaffected by this change;
  re-run to confirm no regression).
- `git status` clean beyond the four intended files (the `npm install`
  side-effect on `package-lock.json` was caught and reverted).
