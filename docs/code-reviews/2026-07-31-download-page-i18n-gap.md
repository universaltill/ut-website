# 2026-07-31 — download.html's untranslated `dl.*` keys

**Card:** universaltill/ut-docs#132 ("Multilingual marketing website (TR/ZH/FA
beyond EN)")

## What the card originally claimed vs. what was actually true

The card's premise — `site/i18n.js` "currently defines only the `en`
column" — was false on inspection: `tr`/`zh`/`fa` translations already
existed in full, with 1:1 key parity against `en` for every page except
one.

## The real gap (BA rescope)

`site/download.html` uses 12 `data-i18n` keys (`dl.title`, `dl.sub`,
`dl.others`, `dl.win.d`, `dl.mac.d`, `dl.pi.d`, `dl.lx64.d`, `dl.lxarm.d`,
`dl.android.d`, `dl.android.note`, `dl.next`, `dl.steps`) that did not
exist in **any** of the four locale dicts. Since `apply()` only overwrites
`textContent` when the dict lookup is non-null, the download page silently
kept its static English source text in every locale — it could never
actually be translated, contradicting the site's own multilingual design.

## What shipped

- Added the 12 missing keys to all four locale dicts in `site/i18n.js`.
  `en` values copied verbatim from the prior static HTML fallback text, so
  the default locale's rendering is provably unchanged; `tr`/`zh`/`fa` are
  new translations matching the file's existing tone/terminology (`kasa`,
  `收银台`, `صندوق`).
- One key (`dl.next`) wraps rich HTML (`<strong>`/`<code>`). Since
  `apply()`'s existing `textContent` assignment would print those tags as
  literal text, added a narrow opt-in `data-i18n-html` attribute
  (`site/i18n.js`'s `apply()`, `site/download.html`'s `dl.next` span) that
  uses `innerHTML` instead — scoped to this one element, not a change to
  the trust model for the rest of the mechanism. Dict values are static,
  developer-authored literals; no user input ever flows into `I18N`.
- Added `scripts/check-i18n-keys.js`: extracts every
  `data-i18n`/`data-i18n-html` key used across `site/*.html`, fails if any
  key is missing from any locale dict, or if the locale dicts don't share
  an identical key set.
- Added `.github/workflows/ci.yml` to run that check on every push
  (non-`main`) and PR.
- Updated `README.md` with a short note on the new check.

## TDD

Red: ran the guard script before the fix — failed with all 12 keys
reported missing in all four locales. Green: after adding the keys,
reran — `OK (4 locales, 157 keys used across 5 pages)`.

Also verified end-to-end in a real headless browser (local static server +
Chromium): loaded `download.html` under each of the four locales
(via `localStorage.ut_lang`, the same mechanism real visitors hit),
confirmed translated text renders, `dir` is correct (`rtl` for `fa`), and
the `dl.next` span's `<strong>`/`<code>` tags render as real DOM elements
in every locale (not literal text).

## Independent review (different model, `opus`)

Verdict: **safe to merge, no blocking issues**. Findings, all
non-blocking, and their disposition:

1. **Fixed** — `check-i18n-keys.js`'s `k in I18N[lang]` walked
   `Object.prototype`, false-passing on a key literally named `toString`/
   `constructor`/etc. Reviewer demonstrated the false pass directly.
   Changed to `Object.hasOwn(...)`; re-verified the false pass is closed
   (injecting `data-i18n="toString"` now correctly fails the guard).
2. **Fixed** — guard would exit 0 vacuously if the extraction regex ever
   stopped matching anything (e.g. an attribute rename). Added an
   explicit `used.size === 0` failure.
3. **Accepted as-is** — the guard doesn't run on direct pushes to `main`
   (mirrors `deploy.yml`'s own trigger, which also only fires on `main`);
   the PR trigger covers the normal branch → PR → merge flow this pipeline
   always uses.
4. **Fixed** — pinned `actions/setup-node@v4` (node 22) in `ci.yml` rather
   than relying on the runner image's preinstalled version.
5. **Not fixed here — new backlog card** (see below) — `download.html`
   still has untranslated visible strings with **no** `data-i18n` at all:
   the primary download CTA label, 9 download-button labels, and several
   JS-injected strings (OS-detection notes, "Latest version:"). The new
   guard can only catch keys that are *referenced but undefined*, not
   strings that were never wired to the mechanism — a structurally
   different, larger task than this card scoped.
6. **Partially fixed** — two wording nits in the new `zh` strings applied
   (`dl.sub`, `dl.others` — more natural phrasing); one `tr` grammar nit
   applied (`dl.lxarm.d`). Left the pre-existing `fa`/`start.dev.pi.d`
   Latin-vs-transliterated-digit inconsistency alone (out of scope — not
   part of this diff).

The reviewer also independently re-ran the TDD red/green sequence
(including recreating the exact pre-fix missing-key state and the
`toString` false-pass), verified `dl.next`'s HTML across all four locales
has balanced/well-formed tags with no stray `<`/`>` or unescaped
ampersands, confirmed no user-controlled data ever reaches `I18N` values,
and checked for hardcoded secrets/real shop names (none found).

## Deferred / follow-up

- New backlog card opened: `download.html` is still substantially
  untranslated beyond these 12 keys (primary CTA button, 9 download
  button labels, JS-injected OS-detection/version strings) — needs its
  own `data-i18n` wiring pass plus the same key-parity treatment.

## Safe-to-merge

Yes. Gate green: `node --check site/i18n.js`, `node
scripts/check-i18n-keys.js` (exit 0), real-browser verification across
all four locales, independent different-model review with the above
findings fixed or explicitly deferred.
