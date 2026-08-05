# Review — ship the actual supplied logo (ut-docs#290, reopened)

**Scope:** this repo's part of the cross-repo remediation of card #290,
2026-08-05. The full record, including why the card was reopened and the
evidence, is `ut-docs/code-reviews/2026-08-05-logo-real-asset.md`.

## Summary

The 2026-08-04 attempt shipped the **previous logo renamed** to
`unitill-logo.svg` — the artwork paths were byte-for-byte identical, only
three Inkscape export-metadata attributes differed. Every check that day
matched on filenames, so nothing caught it. The supplied mark
(`sha256 d4816d6d…`, 4,838 bytes, portrait aspect 0.73) is now in place, and
the guards assert **content**, not filenames.

## Changed here

The website was declared "already byte-identical to the supplied mark" and
skipped. It was identical to the **old** mark.

- `site/logo.svg` — the real supplied mark.
- `site/*.html` — every logo `<img>` pinned both `width` and `height` as a
  layout-shift hint (`34x30` nav, `30x26` footer, five pages). Those are
  landscape and would squash the portrait mark; corrected to `22x30` and
  `19x26`, which match its 54×73 natural size.
- `scripts/check-brand-assets.sh` (new) — asserts the canonical sha256 and
  that every logo `<img>`'s width/height ratio stays within 5% of the mark's
  true 0.74, so a stale landscape pair fails.
- `.gitignore` — `dist/` and `.astro/` were untracked stale build output
  holding a copy of the old logo, and actively confused this audit. The deploy
  ships `site/` directly (`app_location: site`, `skip_app_build: true`).

## Verification

- `node scripts/check-i18n-keys.js` — 4 locales, 167 keys across 5 pages.
- `scripts/check-brand-assets.sh`, wired into `.github/workflows/ci.yml`.
- Driven browser run of the served `site/`: both marks measured 22.0×30.0 and
  19.0×26.0 from a 54×73 natural size, no 4xx.
- Red-then-green: restoring `34x30` on one page fails the guard with the
  offending ratio printed.
- Local static server stopped and port 8123 confirmed free afterwards.

## Left deliberately

The hero screenshot still shows the old mark inside a product screenshot.
Re-capturing product screenshots is its own task, not a branding-asset swap,
and #290's non-goals exclude unrelated redesign. Worth a separate card.
