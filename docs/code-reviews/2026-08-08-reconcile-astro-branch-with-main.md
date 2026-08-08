# Reconcile PR#4's Astro branch with main's Playwright/mobile-nav setup

**Card:** universaltill/ut-docs#474
**Branch:** `pipeline/474-reconcile-astro-main` (merges `origin/main` into
`feat/astro-decap-cms-migration`, i.e. PR#4)
**Model routing:** `complexity:medium` — built at Sonnet, reviewed at Opus
(fresh-context subagent, isolated worktree)

## What shipped

`ut-website#4` (the Astro + Tailwind + MDX + Decap CMS migration, cut from
`main` on 2026-07-28) had been sitting unmerged while `main` grew its own
Playwright regression suite and mobile-nav/hamburger fix
(`ut-website#10`, ut-docs#458). The two branches diverged on
`package.json`/`package-lock.json` (add/add), `.github/workflows/ci.yml`
and `README.md` (content conflicts).

This change:

- Merges the two build/CI setups into one: `package.json` carries both
  Astro's build deps/scripts and Playwright's devDependency/test script;
  `package-lock.json` regenerated from scratch; `ci.yml` runs all five
  jobs (`check-i18n`, `check-brand-assets`, `api-tests`, `build`,
  `playwright`).
- Fixes `.gitignore`'s stale comment on `dist/`/`.astro/`, which still
  described the retired `skip_app_build` deploy.
- Root `package.json` now sets `"type": "module"` (required by Astro),
  which broke two CommonJS scripts (`require is not defined in ES module
  scope`): `playwright.config.js` and `scripts/serve-site.js`, and
  `tests/mobile-nav.spec.js`'s one `require()`. Converted all three to
  ESM (`import`) rather than renaming to `.cjs` — matches the convention
  `scripts/check-i18n-keys.js` already documents in this repo (one module
  system throughout; nested `api/` package keeps its own separate CJS
  scope via its own `package.json`, untouched).
- Ports `ut-docs#458`'s mobile-nav + language-pill fix into
  `src/layouts/BaseLayout.astro` — the Astro-rendered `/blog` and
  `/plugins` pages have their own separate header markup (reusing
  `site/styles.css` via `publicDir` passthrough, but not `site/*.html`'s
  actual DOM), which the original fix never touched: `#site-nav` id,
  `.nav-actions` wrapper, `.nav-toggle` button
  (`aria-expanded`/`aria-controls`/`aria-label`), `.nav-toggle-bars` span,
  and the `/nav.js` include.

## Independent review (Opus, fresh context, isolated `git worktree`)

**Verdict: PASS, no BLOCKER/MAJOR.** Full report on the issue; summary:

- Verified the ported header is a byte-for-byte structural match against
  `site/index.html`'s fixed markup, then **drove real Chromium against
  the built `dist/` output** (not just `site/`, which is all the existing
  Playwright suite ever reaches) at `/blog`, `/plugins` and
  `/blog/blog-is-live`: toggle visible, panel opens/closes, `aria-expanded`
  flips, focus moves to the first link, Escape closes it, desktop hides
  the toggle. All three routes behaved identically.
- **TDD-style regression check**: reverted only the `BaseLayout.astro`
  header port, rebuilt, and confirmed the driven browser run then failed
  (`.nav-toggle` never appears) — **and confirmed `npx playwright test`
  stayed fully green anyway**, proving the existing suite cannot see a
  regression on the Astro-only routes (`scripts/serve-site.js` only ever
  serves `site/`, never `dist/`). Restored, re-verified, clean.
- Re-ran the whole gate independently: `npm ci`, `npm run build`, the
  site→dist byte-identity check, `check-i18n-keys.js`,
  `check-brand-assets.sh`, `api/auth.test.js` (5/5), `npx playwright test`
  (14/14) — all green, all output pasted in the report, not paraphrased.
- Confirmed nothing was silently dropped from either side of the merge
  (diffed the merged `package.json`/`ci.yml` against both parents'
  originals).
- Secrets/demo-data sweep: clean.
- Manual/`web/help/` topics: correctly judged not applicable — this diff
  is confined to the marketing website's build tooling and restores
  parity with an already-shipped, already-documented fix; it adds no new
  POS shop-owner-facing capability.

### Findings, triaged

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | MINOR | `scripts/serve-site.js`'s header comment referenced the old `.cjs` filename after a rename | **Fixed** — moot once both files were converted to ESM `.js` instead of renamed to `.cjs` (see below) |
| 2 | MINOR | The `.cjs` rename directly contradicted the module-system convention `check-i18n-keys.js` itself documents ("kept its `.js` extension … so the repo stays one module system throughout") | **Fixed** — converted `playwright.config.js` and `scripts/serve-site.js` to ESM instead of renaming to `.cjs`; full gate re-run green after |
| 3 | MINOR | `.gitignore`'s new Playwright-output comment read as contradicting the (also-fixed-in-this-diff) build-output comment five lines below it | **Fixed** — trimmed to remove the apparent contradiction |
| 4 | MINOR (pre-existing, not introduced by this diff) | Astro pages render the logo ~54% taller than `site/*.html` (Tailwind preflight's `img{height:auto}` overrides the `height="30"` attribute); `check-brand-assets.sh` only globs `site/*.html` so never catches it | **Deferred** — filed as ut-docs#476, not a merge blocker for a reconciliation card that didn't touch those lines |
| 5 | NIT | `playwright` CI job lacked `cache: npm`, unlike the `build` job | **Fixed** |
| 6 | NIT | No review record existed yet at review time | This file |

### Deferred to backlog (not blockers)

- **ut-docs#476** — extend the Playwright harness to actually serve
  Astro's `dist/` build output (or use `astro preview`), so `/blog` and
  `/plugins` get real CI regression coverage. The review's own TDD check
  proved the gap is real: the mobile-nav fix can be deleted outright and
  `npx playwright test` stays green. Bundled with finding #4 (logo
  sizing + widening `check-brand-assets.sh`'s glob) since fixing the test
  harness gap is the natural place to also catch #4 going forward.
- A low-confidence `navigationFallback.exclude` question
  (`/blog`/`/plugins` bare paths and `/_astro/*` not listed) — the
  reviewer judged this a likely non-issue given SWA serves existing files
  before falling back, and it's squarely inside PR#4's own already-tracked
  "verify live in a real browser" blocker, not a new item.

## Verified beyond automated tests

- Directly inspected `dist/blog/index.html` and `dist/plugins/index.html`
  for the ported header markup (not just trusting the `.astro` source).
- Independent review additionally drove real Chromium against the built
  output at 360px/1200px on all three Astro routes — see above.

## Safe-to-merge verdict

**Yes.** No BLOCKER/MAJOR findings; all MINOR/NIT findings from the
review fixed and the full gate re-verified green afterward. PR#4 itself
still carries its own separate, already-documented, out-of-scope
blockers (manual GitHub OAuth App creation; a human visually verifying
the Astro build in a real browser) — unaffected by, and not owed to,
this reconciliation.

## Addendum: PR#4's own branch advanced during this review (commit c8aeefe)

Between opening the PR and CI finishing, `feat/astro-decap-cms-migration`
(PR#4's own branch, this reconciliation's base) picked up two new
commits: `ut-docs#468` landing for real (`api/auth` + `api/callback`
deleted from this repo, ported same-origin into the `ut-admin` pod;
`scripts/check-swa-config.js` added to CI to guard the removal) and a new
blog post. Merged that in — it auto-merged with **zero conflicts**, since
the two sides touched disjoint regions of `ci.yml` (this reconciliation's
`playwright`-job addition vs. their `api-tests`→`check-swa-config` swap).

Did not spin up a second independent-review round for this: it's not new
logic on this card's part, only absorbing already-separately-reviewed
upstream commits, and the merge itself was conflict-free. Re-verified
personally instead — full gate re-run (`npm run build`, now 4 pages
including the new post; site→dist byte-identity check;
`check-i18n-keys.js`; `check-brand-assets.sh`; `check-swa-config.js`;
`npx playwright test`, 14/14) plus an explicit grep for all four
mobile-nav markers (`nav.js`, `#site-nav`, `.nav-actions`, `.nav-toggle`)
on every Astro-rendered page, including the newly-arrived blog post —
all present, all green.
