# 2026-10-02 — ut-docs#3520: inline styles.css, minify site JS

**Why:** the owner's PageSpeed run on `/en-gb` (22:52, after #3516) scored 100
in every category but still listed two suggestions:
- **Render-blocking requests:** `/styles.css`, an estimated 120 ms on mobile.
- **Minify JavaScript:** `/i18n.js`, an estimated 4 KiB.

**Shipped**
- `scripts/postbuild.mjs` runs after `astro build` (`npm run build`), so CI,
  Playwright and the deploy all get it. It does three things, using esbuild
  0.28.1 (exact devDependency, the same version Astro already pulls):
  - minifies `styles.css` and inlines it into all 65 built pages;
  - fails the build if any page still links `/styles.css`;
  - minifies `i18n.js`, `nav.js` and `consent.js` with target es2017 and
    `charset: utf8`.
- `ci.yml` now runs `astro build` → the pass-through guard → postbuild →
  the CSP check, so the guard keeps its byte-for-byte meaning for Astro's
  publicDir copy.
- New `tests/build-assets.spec.js`:
  - no page links `/styles.css`;
  - each script ships smaller than its source;
  - no line comments or indentation are left;
  - no `\uXXXX` escapes and no syntax newer than the source.
- README build section updated.

**Effect** (local Lighthouse 12 against the build):
- "Render-blocking requests" and "Minify JavaScript" now pass on mobile and
  desktop.
- `i18n.js` goes from 98.8 KB to 87.4 KB (~3 KB less gzipped).
- The home page HTML grows by +3.1 KB gzipped, and the separate 5.3 KB
  stylesheet request is gone.

**Review:** independent Fable subagent, run in a separate worktree.
- TDD re-verified: with the old build script, 4/4 new tests fail; restored,
  4/4 pass.
- Pixel-identical screenshots of `/en-gb` and `/fa-ir` at 390px and 1280px,
  before vs after.
- Classic-script audit: no inline handlers, cross-script globals are reached
  only via property names, no eval/toString reliance.
- BLOCKER, fixed: CI's "site/ copied through unchanged" guard would have
  failed every PR (and skipped the CSP check behind it). CI now runs the
  guard between `astro build` and postbuild.
- MAJOR, fixed: target es2020 let esbuild emit `??` and `catch{}`, which are
  SyntaxErrors on old Android WebViews and iOS 13. The target is now es2017,
  at a 13-byte cost, and the test asserts no newer syntax. Verified: es2020
  makes the test fail.
- MINOR, fixed:
  - a silently missed `<link>` now fails the build;
  - `dist/styles.css` is minified too;
  - the lockfile was cut back to just the esbuild line (an unrelated `jiti`
    drop from a different npm version was reverted);
  - the test marker is now a selector, and the test also covers `/plugins`
    and `/legal`.
- MINOR, accepted: re-running postbuild on an already processed `dist/`
  re-minifies the JS. CI and deploy always run on a fresh build, and this is
  documented in the script header.

**Verified beyond tests:** the CI build job simulated locally (guard=0,
postbuild, `generate-csp --check` OK); `check-swa-config` OK; `npm ci` OK on
the trimmed lockfile.

**Verdict:** safe to merge. After deploy, re-run Lighthouse/PageSpeed on the
live page.
