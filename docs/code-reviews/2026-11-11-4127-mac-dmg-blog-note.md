# Review: Mac install note in the hardware blog post (ut-docs#4127)

- **Author model:** Sonnet · **Reviewer model:** Opus (different-model review) · **Date:** 2026-11-11
- **Scope:** `src/content/blog/{en-gb,de-de,tr-tr,zh-cn,fa-ir}/pos-on-hardware-you-already-own.mdx`
  (Mac paragraph) and a new guard in `tests/install-instructions-current.spec.js`.
- **What shipped:** the post said macOS may block "an app downloaded outside the App Store → Open
  Anyway" about the Mac app, which is the Developer ID signed, notarized `.dmg`. It now says the
  `.dmg` is signed and notarized so macOS asks once on first open, and ties System Settings →
  Privacy & Security → Open Anyway only to the portable `.tar.gz` (`run-unitill.command`). Labels
  match the download page (`dl.next`, `start.mac.2`): DE "Dennoch öffnen", TR "Yine de Aç",
  ZH "仍要打开", FA keeps the English "Open Anyway". Guard: each blog paragraph that contains the
  locale's Open Anyway label must name `.tar.gz`, and the nearest file named before the label must
  be the `.tar.gz`, not the `.dmg`.

Pre-flight: platform/capability claim → ut-website blog in every locale updated; download page
(`site/download.html`, `i18n/*.json` `dl.*`) already correct, n/a; `universal-till/README.md` and
`web/help/` n/a (no till behaviour change); en.json keys n/a (no new keys); review record = this file.

## Findings

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Minor (accuracy) | All 5 locales called the portable archive "not signed". The download page says "not notarized", and the darwin binary carries the Go linker's ad-hoc signature, so "not signed" overstates it. | Fixed: "not notarized" / "nicht notarisiert" / "onaylanmış (notarized) değildir" / "未经公证" / "تأییدشده (notarized) نیست". |
| 2 | Minor (accuracy, ZH) | "`.dmg` 已由 Apple 签名并公证" said Apple signed the `.dmg`. We sign it and Apple notarizes it. | Fixed: "`.dmg` 已签名并经 Apple 公证". |
| 3 | Note (guard scope) | The guard only runs on paragraphs that contain the label, so a future wording that drops the label but still says "macOS may block the .dmg" would not be caught. | Accepted: it covers the regression in the card. The download-page strings have their own spec. |
| 4 | Note (out of scope) | `universal-till/.goreleaser.yaml:327` release notes still say "Open, then Open again (a one-time step until we ship a signed build)". This may be stale now that the `.dmg` is notarized. | Not in this repo: flag to the orchestrator for a Backlog card. |

Also checked: DE/TR/ZH/FA grammar reads naturally; no certification claims (`notarized` is Apple's
process, not a fiscal claim); bold stays on one line and renders as `<strong>` in every locale's
built page.

## Verification (run by reviewer)

- TDD red: with only the `.mdx` changes stashed, `npx playwright test tests/install-instructions-current.spec.js --trace off`
  → `5 failed` (en-gb, de-de, tr-tr, zh-cn, fa-ir: "names the portable archive"), `13 passed`.
- False-pass probe: the EN paragraph was rewritten to mention `.tar.gz` first and then tie Open Anyway to the `.dmg`
  → `1 failed` ("nearest file before the label is the .tar.gz"). File restored.
- Green after fixes: `npx playwright test tests/install-instructions-current.spec.js tests/blog-i18n.spec.js --trace off`
  → `28 passed`.
- `bash scripts/guard-compliance-claims.sh` → no forbidden claims (44 files).
- `npx astro build` → 355 pages built; each locale's post renders its label in `<strong>`.

**Verdict:** OK to commit.
