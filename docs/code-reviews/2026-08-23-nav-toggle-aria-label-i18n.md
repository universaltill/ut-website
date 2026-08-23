# 2026-08-23 — Translate the mobile nav toggle's and language pill's aria-label (ut-docs#467)

## What shipped

Follow-up to 2026-08-08's mobile-nav-lang-switcher work
(`docs/code-reviews/2026-08-08-mobile-nav-lang-switcher.md`), which
deferred exactly this as universaltill/ut-docs#467: the hamburger
toggle's `aria-label` (`"Menu"`/`"Close menu"`) and the pre-existing
`.lang-link` pill's (`"Language"`) were hardcoded English regardless of
the active locale, so a screen-reader user on any non-English locale
heard the one control that unlocks phone navigation announced in
English.

- `site/i18n.js`'s `apply()` gains a `data-i18n-aria-label` attribute
  pass, mirroring the existing `data-i18n`/`data-i18n-html` handling —
  `if (v != null) el.setAttribute("aria-label", v)`.
- Applied to the `.nav-toggle` button and `.lang-link` pill across all
  5 `site/*.html` pages (`index`, `download`, `start`, `store`,
  `language`), and to `src/layouts/BaseLayout.astro`'s identical header
  (see review finding below).
- `site/nav.js`'s dynamic open/close handler now looks up the
  localized string via `window.UT_I18N` instead of hardcoding English —
  the static `apply()` pass alone can't reach this, since it's
  stateful (driven by the click handler, not page load). `i18n.js`
  loads and runs its `DOMContentLoaded` handler before `nav.js` on
  every page (script tag order + `defer` semantics), so `window.UT_I18N`
  is always populated by the time a click can fire; the English literal
  is a defensive fallback only, for the case `i18n.js` fails to load at
  all.
- New `nav.menu` / `nav.menu.close` / `nav.language` keys added to all
  5 locale dicts (en-gb, tr-tr, zh-cn, fa-ir, de-de) — the issue text
  said "four dicts" but `de-de` was added to the repo since the issue
  was filed; verified all 5 got the new keys, not just the original 4.
- `check-i18n-keys.js`'s scan regex extended to also catch
  `data-i18n-aria-label`, and its scan scope widened from `site/*.html`
  only to also cover `src/**/*.astro` (review finding 3 below) — a
  pre-existing blind spot for plain `data-i18n`/`data-i18n-html` too,
  not just the new attribute.
- New Playwright coverage in `tests/mobile-nav.spec.js` (5 new tests):
  toggle aria-label translated + reverts correctly across open/close
  (tr-tr), language pill aria-label translated (de-de), English
  default unchanged (regression guard), and the two Astro-rendered
  pages (`/blog`, `/plugins`) added after the review below.

## Independent review (Opus, different model from the Sonnet that
implemented this — model routing per this card's `complexity:medium`
label)

Found the core fix correct, minimal, and genuinely tested for the 5
hand-written pages — re-verified the TDD claim independently by
restoring the pre-fix code and confirming the new tests fail
bug-shaped, then restoring. No blocker (nothing money/tax/data-loss/
security — static marketing site). Findings and disposition:

| Severity | Finding | Fixed? |
|---|---|---|
| Non-blocker (real, user-facing) | `src/layouts/BaseLayout.astro` renders the exact same header for `/{locale}/blog`, `/{locale}/blog/{slug}` and `/{locale}/plugins` — the pages search traffic actually lands on — but didn't get `data-i18n-aria-label`; confirmed live (`/tr-tr/blog`, `/fa-ir/plugins` both still announced English on load, and inconsistently switched to the local language after the nav.js fix's first open/close) | **Yes** — added the same two attributes to `BaseLayout.astro`; new Playwright tests for `/tr-tr/blog` and `/fa-ir/plugins` cover both the static load state and the dynamic open/close state |
| Non-blocker (hardening) | `nav.menu.close` is referenced only from a JS string literal in `nav.js`, never a `data-i18n-*` HTML attribute — so it's covered only by the cross-dict parity check, not the "used vs. defined" check; a typo would silently keep the English fallback with a green guard | Not fixed — the existing Playwright test does assert the literal localized string (`"Menüyü kapat"`), which is the actual regression net for this specific key; widening the guard itself to parse JS string literals is a distinct, riskier change (false-positive-prone regex over arbitrary JS) not worth it for one key. Left as documented residual risk, not deferred to a new card — low severity, real net (the Playwright test) already exists |
| Non-blocker (hardening) | Guard scope didn't cover `src/**/*.astro` at all (precedent: the compliance-claims guard already does) | **Yes** — same fix as finding 1, done together since fixing 1 without this would leave the new `BaseLayout.astro` keys unguarded, the identical silent-gap class this card exists to close |
| Non-blocker (docs) | `README.md`'s description of `check-i18n-keys.js` didn't mention `data-i18n-aria-label` or the `.astro` scope | **Yes** — one-line update |
| Informational | `apply()` sets the toggle's `aria-label` unconditionally from the static `nav.menu` key; if `apply()` ever re-ran while the menu was open (currently unreachable — `UT_I18N.go()` has no callers, `language.html` uses real `<a href>` navigation, no `popstate` fires from a same-page open/close) the button would announce "Menu" while `aria-expanded="true"` | Not fixed — genuinely unreachable today, recorded here so it isn't a surprise if in-page language switching is ever added |

## Verified beyond automated tests

- `node scripts/check-i18n-keys.js` — OK, 5 locales, 176 keys across 9
  scanned files (5 `site/*.html` + `src/**/*.astro`), no key drift.
- `npx playwright test` (full suite, Chromium, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)
  — 86/86 pass, including the 5 new tests.
- TDD re-verified independently, twice: once by me (`git stash` the JS/
  HTML changes, confirm the 2 real regression tests fail bug-shaped —
  `unexpected value "Menu"`/`"Language"` — while the English-default
  sanity test still passes; restore, confirm all pass again), and once
  by the review subagent via the same technique against the final
  diff including the Astro fix.
- Manually confirmed `window.UT_I18N` is assigned synchronously at the
  `i18n.js` IIFE's top level, not inside its `DOMContentLoaded`
  handler, and `nav.js` only wires click handlers on `DOMContentLoaded`
  — so the fallback-only claim about script load order is correct, not
  assumed.
- Confirmed no XSS surface — the new code path uses `setAttribute`,
  never `innerHTML`, for the aria-label value.
- Confirmed RTL is unaffected — `aria-label` is non-visual, and nothing
  CSS-side was touched; `fa-ir` labels resolve correctly at runtime
  (`منو` / `بستن منو`).

## Safe-to-merge verdict

Safe to merge. The one real (non-blocker) finding — the Astro pages
still shipping the original bug — is fixed and covered by new tests in
the same PR, since it's the same defect on the same header, not scope
creep. The remaining findings are documented hardening/informational
notes with no live risk today.

## Explicitly deferred

- None. Everything the review raised is either fixed in this PR or
  recorded above as a documented, currently-unreachable/low-severity
  residual, not owed as a follow-up card.
