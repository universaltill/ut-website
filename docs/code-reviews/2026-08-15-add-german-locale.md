# 2026-08-15 — Add de-de (German) locale

**Card:** universaltill/ut-docs#604
**Branch:** `add-german-locale`
**Model routing:** complexity:medium — built inline (Sonnet, this session), reviewed by
an independent, fresh-context Opus subagent (worktree-isolated, no prior context on
this diff).

## Why

`ut-website/site/i18n.js` defined four locales (en-gb/tr-tr/zh-cn/fa-ir) while a German
pilot café is a committed, named prospect. The public marketing site — the first thing
a German shop owner searching for a POS would land on — had Chinese and Persian but no
German. p2, not pilot-blocking (the café arrives via personal introduction, not search),
but real for the *next* German shop.

## What changed

- `site/i18n.js` — new `de-de` block: 189 translated string keys, full key parity with
  `en-gb` verified programmatically (0 missing/extra/duplicate, confirmed independently
  twice — once by Tester, once by Reviewer using a hand-written tokenizer rather than
  `Object.keys` alone, since object literals silently dedupe). `_name: "Deutsch"`,
  `_english: "German"`, `_dir: "ltr"`. Header comment (`Launch markets: EN, TR, ZH, FA.`)
  updated to include DE — review finding, fixed.
- `site/staticwebapp.config.json` — 5 new `/de-de/*` routes (root/download/start/
  store/language), structurally identical to an existing locale's block.
- `site/index.html`, `site/start.html` — `hreflang="de-DE"` added (the only two
  `site/*.html` pages that carry hreflang tags for any locale — confirmed by grep that
  `download.html`/`store.html` have zero hreflang tags for any existing locale, so
  they're correctly left untouched; that gap is pre-existing and out of scope here).
- `src/layouts/BaseLayout.astro` — `'de-de'` added to `LANGS` and `DIR` (`ltr`). This
  alone wires up the Astro-built `/de-de/blog` and `/de-de/plugins` routes plus their
  hreflang alternates and sitemap entries (`sitemap.xml.ts` derives from `LANGS` and
  `staticwebapp.config.json` — correctly not touched directly).
- `tests/seo.spec.js`, `tests/site-consistency.spec.js`, `tests/rtl-content-direction.spec.js`
  — `"de-de"` added to every locale-iterating list, including the hardcoded expected
  hreflang array and the exact-translated-CTA-string map. The last file was originally
  missed by Dev/Tester (caught by Reviewer) — three hardcoded 4-locale lists there (the
  `/plugins` forced-`ltr` check, the homepage-plugins-link check, and the exact-CTA-
  string check) got no de-de coverage; fixed in this pass.
- `README.md` — locale-count mentions updated (`en/tr/zh/fa` → `en/tr/zh/fa/de`), except
  the "posts are translated... using translate-posts.js" section, which deliberately
  still lists only tr-tr/zh-cn/fa-ir (see non-goals).

**Non-goals, deliberately not done:** no existing blog post translated into German (a
new locale falls back to English via the existing "not translated yet" banner, same as
any locale's untranslated post — confirmed live: `/de-de/blog/whats-new-v0-2-70` renders
the English body under that banner); no hreflang added to `download.html`/`store.html`
(pre-existing gap affecting every locale equally).

## Verification

- TDD: test files extended with `de-de` *before* implementation; ran
  `npx playwright test tests/seo.spec.js tests/site-consistency.spec.js` against the
  unimplemented state and got exactly 6 real failures (missing routes/hreflang/Astro
  route), each with a genuine error message, not a vacuous pass.
- Tester independently re-verified from a clean `npm ci`: full Playwright suite green,
  both CI guard scripts (`check-i18n-keys.js`, `check-swa-config.js`) green, drove all
  seven `/de-de/*` surfaces live in a browser (desktop + mobile viewport) with
  screenshots, confirmed `nav.news` is genuinely translated (not identical to English),
  grepped `download.html`/`store.html` independently, confirmed zero blog-content files
  touched.
- Full gate after Reviewer's fixes: `npx playwright test` → **81 passed** (78 → 81 after
  extending `rtl-content-direction.spec.js`'s three lists), `check-i18n-keys.js` → OK
  (5 locales, 169 keys), `check-swa-config.js` → OK.

## Independent review (fresh-context Opus subagent, worktree-isolated)

**Verdict: safe to merge, no blocking findings.**

Independently re-derived key parity with its own tokenizer (not trusting the Dev/Tester
claim), rendered `dl.next`'s HTML-bearing translation in a real browser to confirm all
30 tags/12 `<code>` spans are byte-identical to the English source with only text nodes
changed, verified the SWA route block shape programmatically, read all of
`BaseLayout.astro` to confirm `LANGS`/`DIR` are the only locale-dependent constructs,
and drove the site live itself rather than trusting prior screenshots.

**Re-verified TDD twice, independently:**
1. Reverted all five implementation files → 6 real failures, same as Dev's original
   TDD run, each with a substantive error message (missing sitemap entries, 404s,
   `h1` locator not found, hreflang array diff, post-count mismatch).
2. A second, finer-grained revert of *only* `site/i18n.js` (isolating the 189-string
   block from the `LANGS` change) → still failed for real (`i18n.js`'s own runtime
   sanitizes an unsupported locale and falls back `documentElement.lang` to `en-gb`),
   proving the translation block itself — not just the routing wiring — is genuinely
   covered.
3. Restored, confirmed 34/34 passing again on the two affected spec files.

**Non-blocking findings, triaged:**
1. `tests/rtl-content-direction.spec.js`'s three hardcoded locale lists had no de-de
   entry — **fixed** in this pass (see above).
2. `site/i18n.js`'s header comment was stale — **fixed** in this pass (see above).
3. `scripts/translate-posts.js`'s `LOCALES` map has no `de-de` entry — genuinely out of
   scope (blog translation is an explicit non-goal for this card); **new Backlog card
   filed** so the German blog isn't permanently stuck on English fallback once someone
   picks up post translation.
4. Three independent, unsynced locale lists (`i18n.js` dict keys, `BaseLayout.LANGS`,
   the SWA route blocks) with only the Playwright suite catching drift between them —
   pre-existing design, not introduced by this diff, no action taken.
5. `tour.lang.d` marketing copy ("English, Turkish, Chinese, Persian and more") wasn't
   updated to name German explicitly — "and more" technically still covers it, and
   editing it means touching all five locale blocks' copy, not just adding one; left
   as a copy-polish item, not fixed here.
6. "Jetzt starten" (hero/CTA) vs. "Loslegen" (nav) — a legitimate translation choice
   within German (both correct), just a minor divergence from how English/Turkish
   reuse one string for both. Not a defect.
7. `/de` 404s while `/tr`/`/zh`/`/fa` redirect to their region-tagged form — deliberate
   and correct: those three exist only because they were previously-live URLs
   advertised in hreflang before the region-tag convention; `/de` never existed, same
   as `/en`.
8. `why.contracts.d` keeps the GBP price ("£70") in the German copy — consistent with
   existing precedent (tr-tr and zh-cn also quote GBP); a content decision for the
   product owner if it's ever revisited, not an engineering defect.

No real client/shop name used; no secret-shaped literals introduced (both N/A — this
diff is translation/config/markup only). No filesystem writes, no cwd-relative paths.
UI-guideline (`ux-guidelines.md`) and `web/help/` manual checks not applicable — static
marketing site, not the till application.

## Result

Merged via `merge_method: "merge"` (regular merge commit, per this pipeline's standing
commit-attribution policy — see `reviewer` skill). `https://www.universaltill.com/de-de/`
serves a fully translated German marketing site, blog and plugin catalogue chrome, with
correct sitemap/hreflang/RSS coverage. A follow-up Backlog card covers translating
existing blog posts into German.
