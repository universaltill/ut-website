# Code review: download.html remaining i18n gaps (ut-docs#182)

**Date:** 2026-07-31
**Author:** Dev/Reviewer (autonomous SDLC pipeline)
**Independent review:** separate subagent, `opus` model (different from the
implementing model, `sonnet`)

## What shipped

Follow-up to `ut-website#7`/`ut-docs#132` (still open, unmerged as of this
review — see Non-goals). That earlier fix filled in the 12 `data-i18n` keys
on `site/download.html` that were referenced in the HTML but missing from
every locale dict. Its own independent review found `download.html` still
had several *visible* strings that were never wired to `data-i18n` in the
first place — filed as `ut-docs#182`. This change closes that gap:

- Added `data-i18n="dl.*"` to the primary download CTA button label
  (`#primary-link`, "Download") and the 9 per-OS download-button labels
  (Windows installer, Portable ×2, macOS app, Raspberry Pi .deb,
  Debian/Ubuntu .deb, Other Linux .tar.gz, ARM64 .tar.gz, Android .apk).
  No JS change needed for these — the existing `apply()` in `site/i18n.js`
  already walks `[data-i18n]` and swaps `textContent`.
- Rewired the JS-injected copy in the inline `<script>` (OS-detection
  `os`/`note` strings, the "Latest version: " prefix): `detect()` now
  returns i18n keys alongside English fallback text, and a small `t(key,
  fallback)` helper resolves the current-language string from
  `window.UT_I18N`.
- **Load-order fix**: the primary-card script used to be a plain
  immediately-invoked function, which runs *during* HTML parsing — before
  the deferred `i18n.js` has executed, so `window.UT_I18N` wasn't
  guaranteed to exist yet. Wrapped it in
  `document.addEventListener("DOMContentLoaded", ...)` instead; deferred
  scripts always finish running before `DOMContentLoaded` fires, regardless
  of listener registration order, so `window.UT_I18N` is guaranteed set by
  the time this listener runs. (A bare `defer` on an inline script with no
  `src` has no effect per spec — not used.)
- Added 22 new keys × 4 locales (en/tr/zh/fa) to `site/i18n.js`, all real
  translations matching the file's existing tone/terminology (verified
  against nearby `start.win.*`/`start.mac.*`/etc. entries covering the same
  devices).
- Copy-only: OS-detection regexes, the `SUFFIX` map, `mirror()` fallback
  URLs, the Client Hints re-detect gate, and the GitHub Releases API fetch
  logic are all byte-identical to before — confirmed by stripping string
  literals from both versions and diffing.

## Independent review findings

1. **Fixed (real, non-blocking-but-worth-fixing):** `t(best.osKey,
   best.osKey)` fell back to the raw key itself (e.g. literal
   `dl.os.linux64`) if `window.UT_I18N` was ever unavailable, instead of
   readable English — user-visible garbage on the primary CTA card in that
   edge case, and inconsistent with the sibling `t("dl.version.prefix",
   "Latest version: ")` call which already fell back to English correctly.
   Fixed: `detect()` now carries both the i18n key and the English fallback
   text; `t()` calls pass the real fallback, not the key.
2. **Fixed (nit):** Farsi `dl.note.windows` used an ezafe construction
   ("جادوگر" as installer's wizard) inconsistent with the file's own
   established phrase `جادوگر راه‌اندازی` (`start.s3.t`). Reworded to
   `نصب با جادوگر راه‌اندازی`.
3. **Accepted, no action:** the primary card now paints after `i18n.js`
   downloads rather than mid-parse — same-origin, non-render-blocking in
   practice (styles.css already gated the old inline script), negligible.

## Verified beyond the independent review

- `node --check site/i18n.js` and the extracted inline `<script>` — clean.
- Programmatic key-parity check across all 4 locale dicts: 173 keys each,
  zero missing/extra in any direction.
- Every `data-i18n` value in `download.html` and every `dl.os.*`/
  `dl.note.*`/`dl.version.prefix` key referenced from the script resolves
  in the `en` dict — the only unresolved `data-i18n` values are the 12
  pre-existing keys tracked separately by `ut-website#7` (out of scope
  here; this diff introduces no new gaps).
- Real headless-Chromium run (Playwright, local static server) across all
  four locales (`localStorage.ut_lang`): CTA + all 9 button labels +
  primary-card OS/note text render translated and non-empty; `dir=rtl` for
  `fa`, `ltr` otherwise.
- Re-ran the same browser check after the two fixes above — no regression.
- Directly reproduced the fallback path (blocked `i18n.js` from loading
  entirely) and confirmed the primary card now shows readable English
  ("Linux (64-bit)" / "Debian / Ubuntu, 64-bit"), not a raw key.
- No file writes anywhere in this diff, so the two recurring bug classes
  (`os.MkdirAll` / `paths.Data(...)` misuse) this pipeline keeps checking
  for are structurally not applicable — confirmed by inspection, not just
  assumed.
- No secrets, no real client/shop name.

## Non-goals (unchanged from the issue)

- No change to OS-detection logic or the mirror/GitHub-Releases-API
  upgrade behavior — copy-only, mechanically confirmed above.
- No new i18n mechanism beyond the existing `data-i18n` (`data-i18n-html`
  wasn't needed here — none of the new strings carry embedded markup).
- Does **not** depend on or wait for `ut-website#7`/`ut-docs#132`
  (currently open, unmerged): that PR's 12 keys and this PR's 22 keys are
  disjoint; `scripts/check-i18n-keys.js` (added by #7) will cover these new
  keys automatically once #7 merges, but isn't required for this change to
  be correct on its own — verified manually instead (above).

## Verdict

Safe to merge.
