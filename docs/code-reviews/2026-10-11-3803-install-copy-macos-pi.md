# 2026-10-11 — Download/start page install copy: macOS first launch + Pi kiosk (ut-docs#3803)

**Branch:** `fix/3803-download-page-install-copy`
**Reviewer:** independent Fable subagent (code by Opus 5.5), read-only on the working tree.

## What shipped

- `site/i18n.js` `dl.next` (download page, HTML) and `start.mac.2` (start page, text) in all
  5 locales (en-gb, tr-tr, zh-cn, fa-ir, de-de), plus the matching English fallbacks in
  `site/download.html` and `site/start.html`:
  - **macOS `.dmg`:** the "right-click → Open to clear the unsigned-app warning" step is gone.
    The v0.31.8 `.dmg` and the app inside are Developer ID signed, notarized and stapled
    (verified on this Mac, macOS 27.0.1: `spctl -a -vvv` → `source=Notarized Developer ID`;
    `xcrun stapler validate` OK), so macOS only asks once to confirm.
  - **macOS portable `.tar.gz`:** `run-unitill.command` is unsigned (`codesign -dv` → not
    signed; `spctl` rejected). Right-click → Open no longer overrides that since macOS 15, so
    the copy now says System Settings → Privacy & Security → **Open Anyway**. Labels taken from
    macOS's own `SecurityPrivacyExtension` loctables: DE "Datenschutz & Sicherheit" / "Dennoch
    öffnen", TR "Gizlilik ve Güvenlik" / "Yine de Aç", ZH "隐私与安全" / "仍要打开"; FA names the
    English labels (macOS has no Persian UI).
  - The portable sentence no longer offers `unitill-desktop` on macOS: the darwin archive
    contains no such binary (checked by listing v0.31.8's tarball).
  - **Raspberry Pi:** the manual `sudo /usr/lib/unitill/unitill-kiosk-setup` step is replaced
    by the shipped behaviour (universal-till README): fresh Pi OS Lite → reboot once, first
    boot sets up the kiosk; Pi OS with Desktop → fullscreen overlay at login, Settings →
    Display → "Exit to OS window" (the till's own translated label per locale).
- Blog label corrections: DE "Trotzdem öffnen" → "Dennoch öffnen", ZH "隐私与安全性" → "隐私与安全".
- New guard `tests/install-instructions-current.spec.js` (13 tests): no right-click → Open
  wording (5 languages) anywhere in `site/`/`src/`; no `unitill-kiosk-setup` in the install
  steps (`dl.*`/`start.*` keys, download/start pages); every locale's `start.mac.2` names the
  localized Open Anyway; `dl.next` names it exactly once, right after `run-unitill.command`,
  and describes both Pi OS variants.

## Findings

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | The kiosk-setup ban scanned all of `site/`+`src/`, blocking a legitimate note for Pis upgraded in place (README still documents the command for that) | **Fixed**: ban scoped to install-step keys/pages |
| 2 | Low | Blog `pos-on-hardware-you-already-own` still implies the `.dmg` may need Open Anyway | **Deferred** → ut-docs#4127 (Backlog) |
| 3 | Low | "signed and notarized by Apple" — the signature is the Developer ID's | **Fixed** in all 5 locales + fallback |
| 4 | Low | `start.mac.1` says "unzip" for a `.tar.gz` | Accepted (pre-existing; Finder extracts on double-click) |

Also found while testing: the prerender serializes a bare `&` in `data-i18n-html` as `&amp;`
(`seo-prerender.spec.js` failed), so `dl.next` now carries `&amp;` itself. Fixed.

## Verified

- TDD: with the three site files reverted to `main`, the new spec fails 12/13; restored, 13/13.
- Full suite `npx playwright test`: 307 passed. `check-i18n-keys.js`, `check-swa-config.js`,
  `guard-compliance-claims.sh`, `generate-csp.js --check` OK. `check-documented-paths.sh` now
  finds no `/usr` path to verify (the only one was the stale command) and exits 0; it re-arms
  if a path comes back.
- Driven run (`serve-site.js` on the built `dist/`), screenshots read: de-de download at 360px
  and 1024×600, fa-ir download at 360px (RTL), en-gb start at 1024×600, tr-tr start at 360px —
  no horizontal overflow (`scrollWidth` = viewport), nothing clipped. Not looked at: zh-cn
  screenshots (text checked by the reviewer only), dark theme (copy-only change).
- Not verified: a real macOS 15+ first launch of a downloaded file (the quarantine prompt
  itself); the Gatekeeper assessment was checked with `spctl` instead.

**Verdict:** safe to merge.
