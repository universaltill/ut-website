# Review: Android download page offers each device its own package (ut-docs#1541)

**Shipped:** the Android card on `/download` now offers:
- **64-bit (most devices)** as the primary download, `/downloads/unitill-pos_android-arm64.apk`;
- **older 32-bit devices**, `…_android-armv7.apk`;
- **Not sure? Universal (larger)**, `…_android.apk`.

Android auto-detection picks arm64. It switches to armv7 only when the `bitness` Client Hint says `"32"`. `scripts/download-redirects.sh` adds the two per-ABI stable paths. Each falls back to the universal APK while a release lacks the per-ABI assets, so a link never 404s during the move to the new assets. The live GitHub-API matching falls back the same way. Four i18n keys were added in all 5 locales, and the unused `dl.android.apk` was removed. The CSP hash is regenerated.

Owner, 2026-10-14: "each system must download the correct package suite for its own configuration."

**Review:** independent, Fable (written by Opus 5.5). Approved.
- **Low:** the `bitness` hint is the browser's bitness, so 32-bit Chrome on a 64-bit device gets armv7. That build still installs and runs. Accepted, and documented in a code comment.
- **Low:** the fallback runs only one way: if the universal APK is ever dropped, its stable path 404s. Out of scope while the universal APK ships, because it is the update path for v0.34.x tills.
- **Nits:** a stale `refineAndroid` comment (fixed). `mirror()` would build a double-underscore path if `STABLE.android` were removed; it is guarded today.
- **Verified:** redirect fallback in both transition states. Non-Android detection is unchanged. All locales carry the keys.

**Checks:**
- `download-redirects_test.sh` passes.
- `check-i18n-keys.js`: OK.
- `check-swa-config.js`: OK.
- `generate-csp.js --check`: OK, after `--write` for the comment edit.
- Playwright `download-detect.spec.js`: 9/9 passed.
- The full Playwright suite (312) passed at the Dev step.

**Verdict:** safe to merge. The page is safe before the universal-till release that publishes the per-ABI assets, because of the fallback.
