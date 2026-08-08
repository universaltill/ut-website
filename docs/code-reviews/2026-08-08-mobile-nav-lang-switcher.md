# 2026-08-08 — Mobile nav + language-switcher fix (ut-docs#458)

## What shipped

Two bugs on `universaltill.com`'s header, both only visible at mobile
widths:

1. **Language pill hidden by a CSS specificity bug.** `.lang-link`
   (specificity 0-1-0) lost to `.nav nav a:not(.btn)` (0-2-1) inside the
   `@media (max-width: 560px)` rule, so the pill the author's own adjacent
   rule clearly intended to keep visible was hidden anyway.
2. **No mobile nav menu at all.** Every other link (Solutions, Tour, Why
   it's different, Hardware, Plugins, Store, About) was simply hidden with
   nothing replacing it — no hamburger, no drawer — making the site's
   entire navigation unreachable on a phone.

Fix, applied identically across all five pages sharing this header
(`index.html`, `download.html`, `start.html`, `store.html`,
`language.html`):

- Restructured the header markup so the collapsible link list
  (`<nav id="site-nav">`) is a sibling of a new `<div class="nav-actions">`
  holding the primary CTA, the language pill, and a new hamburger
  (`.nav-toggle`) — structurally separating "always visible" from
  "collapsible" so bug 1's specificity class can't recur, rather than just
  patching selector strength.
- At ≤560px, `#site-nav` becomes a full-width dropdown panel under the
  sticky header (`position: absolute`, `inset-inline: 0`, `top: 100%`),
  using only logical CSS properties for every direction-sensitive rule, so
  it is automatically correct under `dir="rtl"` (Persian/Arabic) with no
  extra rules — a top-down panel sidesteps "which side does it open from"
  entirely.
- New `site/nav.js` (vanilla): toggles `.nav-open` + `aria-expanded`/
  `aria-label`; closes on link-click, Escape (refocuses the toggle), or
  outside-click; moves focus into the panel's first link on open so Tab
  order follows what's now on screen; resets state if the viewport crosses
  back over the breakpoint while open.
- New Playwright regression suite from scratch (the repo had none) —
  `package.json`, `playwright.config.js`, `scripts/serve-site.js` (a
  Node-only static file server for tests only), `tests/mobile-nav.spec.js`
  — 14 tests covering AC1–AC3, RTL, keyboard focus order, and a
  cross-page smoke check on all five pages. Wired into
  `.github/workflows/ci.yml` as a new `playwright` job.

## Independent review (Opus, different model from the Sonnet that wrote
this — model routing per this card's `complexity:medium` label)

Found the implementation's core approach sound (the structural
always-visible/collapsible split, the `position: sticky` containing-block
reasoning, the ARIA wiring, the close-behaviour edge cases, the TDD
claim — independently re-verified by reverting the fix and confirming all
10 original tests failed bug-shaped, then restoring) but **not safe to
merge as-is**. Findings, and their disposition:

| Severity | Finding | Fixed? |
|---|---|---|
| **Blocker** | Removing `margin-inline-start: auto` from `.nav nav` (moved to `.nav-actions`) collapsed every page's desktop header from right-aligned to left-clustered — up to 646px of shift, undeclared, and the test named "desktop layout … untouched" couldn't see it because it only asserted visibility | **Yes** — restored the margin on `.nav nav`, added it back to `.nav-actions` only inside the mobile media query where `#site-nav` leaves flow; the desktop test now also asserts the link group stays past 55% of the header width |
| Should-fix | Mobile panel rows centred to content width (inherited `align-items: center`), leaving ~70% of each row's tap area dead | **Yes** — `align-items: stretch` on `#site-nav` |
| Should-fix | RTL test was vacuous — a mutation to a physical `left:0; width:65%; text-align:left` "half-fix" (the exact failure mode the ticket calls out) still passed all 10 tests | **Yes** — added a text-geometry assertion via `Range.getBoundingClientRect()` (the anchor's own box is stretched full-width now, so measuring *it* would have been equally vacuous); re-verified the same mutation now fails |
| Should-fix | New narrow-viewport (280–320px) horizontal overflow on 4 of 5 pages, absent pre-fix (the pill was simply hidden there before) | **Yes** — `flex-wrap: wrap` on `.nav` |
| Should-fix | Keyboard: opening the menu via Enter left Tab order pointing past it into page content, because the toggle button is later in DOM order than the panel it reveals | **Yes** — `openMenu()` moves focus to the panel's first link; new test asserts this |
| Should-fix | `nav.js` missing from `staticwebapp.config.json`'s `navigationFallback.exclude` — would be swallowed and rewritten to `index.html` in production (blocked outright by the existing `X-Content-Type-Options: nosniff` header), while local tests couldn't see the difference | **Yes** — added `/nav.js` to the exclude list |
| Should-fix | Open panel has no `max-height`/scroll on short viewports (landscape phones, split-screen) — last link(s) permanently unreachable | **Yes** — `max-height: 78dvh; overflow-y: auto` (confirmed `calc(100dvh - 100%)` silently no-ops here, since the percentage resolves against an auto-height containing block) |
| Should-fix | Toggle's `aria-label` ("Menu"/"Close menu") is hardcoded English in all four locales | **Deferred** — filed as universaltill/ut-docs#467. Fixing properly needs a new attribute-translation path in `site/i18n.js`'s `apply()` (it currently only rewrites `textContent`/`innerHTML`), which is its own reviewable unit of work; `.lang-link`'s `aria-label="Language"` is the same pre-existing pattern, unaddressed before this ticket and not introduced by it |
| Nitpick | Resizing past the breakpoint with the menu open left stale `aria-expanded`/`.nav-open` state | **Yes** — `matchMedia` listener closes the menu on crossing back to desktop width |
| Nitpick | `scripts/serve-site.js`'s path-prefix guard (`startsWith(ROOT)`) and missing image MIME types | **Deferred** — test-only tooling, no production exposure (`site/` ships directly per `deploy.yml`), low value relative to cost right now |
| Nitpick | Comment claimed "logical properties only" while using physical `top` | **Yes** — reworded for accuracy (`top` has no directional meaning, so it's correctly physical) |

## Verified beyond automated tests

- Manually screenshotted the open mobile menu in English (LTR) and Persian
  (RTL) at 375px — confirmed visually mirrored, full-width rows, correct
  brand/toggle/CTA ordering on both sides.
- Manually re-screenshotted the desktop header (1200px) on `/` and
  `/store` after the alignment fix — confirmed trailing-aligned, matching
  the pre-existing design.
- Reproduced the reviewer's exact RTL-defeating mutation
  (`left:0; width:65%; text-align:left`) against the final code and
  confirmed the rewritten RTL test now fails on it (previously it passed).
- `node scripts/check-i18n-keys.js` — OK, 4 locales, 167 keys, no key
  drift introduced.
- `bash scripts/check-brand-assets.sh` — pass.
- `npx playwright test` — 14/14 pass (10 original + 4 added during
  review triage: focus-order-on-open, and extending the cross-page smoke
  loop from 2 pages to all 4 non-homepage pages).
- TDD re-verified independently by both the Dev subagent and, separately,
  the review subagent in an isolated worktree (revert → 10/10 fail,
  bug-shaped errors, not harness errors → restore → 10/10 pass).

## Safe-to-merge verdict

Safe to merge. All blocker and should-fix findings from the independent
review are resolved and re-verified (individually, via targeted mutation
testing, and together via the full suite); the one deferred should-fix
(localized `aria-label`) is a distinct, appropriately-scoped follow-up
rather than scope creep on this ticket, tracked on the board.

## Explicitly deferred

- universaltill/ut-docs#467 — localize the mobile-menu toggle's
  `aria-label` (and, while there, `.lang-link`'s pre-existing one) via a
  new `data-i18n-aria-label`-style mechanism in `site/i18n.js`.
- `scripts/serve-site.js` path-prefix/MIME nitpicks — no production
  exposure, left as-is.
