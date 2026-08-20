# 2026-08-20 — Extend the compliance-claims wording guard to ut-website

**Card:** universaltill/ut-docs#702
**Branch:** `feat/702-compliance-claims-guard-website`
**Model routing:** complexity:easy — built inline (Sonnet). Reviewed by an
independent fresh-context Sonnet subagent (this card's tier relaxes "a
different model" to "a different, clean-context instance" — see the
`reviewer` skill).

## Why

`universal-till` already enforces the product-owner-approved fiscal-compliance
wording denylist (ut-docs#667, approved 2026-08-13) via
`scripts/ci/guard-compliance-claims.sh`, across its locale strings, help
manual and UI templates — no "GoBD-compliant", "revisionssicher"/
"audit-proof", "certified by the Finanzamt", or claims that we file a
merchant's §146a Abs. 4 AO notification on their behalf (ADR-0040). That
card's own acceptance criteria named `ut-website` as the immediate next
surface: it's sales copy rather than product UI, and the surface most likely
to actually carry an outcome claim once someone writes German marketing text
for the pilot.

Split out as ut-docs#702; this is that port.

## What changed

- **`scripts/guard-compliance-claims.sh`** (new) — same product-owner-approved
  19-term denylist as `universal-till`'s guard, byte-for-byte (duplicated
  across the two repos deliberately — the card's own acceptance criteria
  accepts this for two repos, revisit only if a third needs it). Adapted to
  this repo's actual layout, which has no per-locale JSON files or
  `web/help`/`web/ui` dirs:
  - `site/i18n.js` — every locale's UI copy, one file (no `compliance-claim:
    allow` hatch here, same rationale as `universal-till` excluding its
    locale JSON: translated UI copy has no legitimate reason to quote a
    forbidden phrase).
  - `src/content/blog/**/*.mdx` — blog content, per locale (allow-hatch
    enabled via HTML comment, same as the precedent's help topics).
  - `site/*.html` — the plain-HTML marketing pages (allow-hatch enabled).
  - `src/**/*.astro` — every Astro page *and* layout, not just
    `src/pages/` (a literal here bypasses `data-i18n` entirely, same blind
    spot the precedent's UI-template scan exists to catch; allow-hatch
    enabled).
  Fails closed per surface (each of the three directory surfaces
  independently errors if it finds zero matching files), same as the
  precedent, and forces `LC_ALL=C.UTF-8` for the same cased-umlaut reason
  (ut-docs#662).
- **`scripts/guard-compliance-claims_test.sh`** (new) — regression suite
  mirroring `universal-till`'s: the full permitted-phrasing fixture passes;
  each of the 19 forbidden terms (case-varied, including the German forms and
  the one with a cased Ü) is caught when planted in `site/i18n.js`; the same
  term is independently caught in a blog post, a marketing page, and an Astro
  page; the `compliance-claim:allow` marker suppresses a match on those three
  surfaces but is explicitly proven **not** honoured on `site/i18n.js`; a
  missing locales file and each surface going empty alone both fail closed;
  the real, unmodified repo tree passes.
- **`.github/workflows/ci.yml`** — new `check-compliance-claims` job
  (`runs-on: ubuntu-latest`, matching every other job in this public repo —
  no self-hosted runner exposure), running the guard then its test.
- **`README.md`** — documents the new script + CI job in the existing
  bullet-list convention.

## Independent review

Fresh-context Sonnet subagent, briefed with the `universal-till` precedent
script and this repo's README, told to run things rather than just read.
Verdict: **safe to merge**. It independently:
- Ran the guard and the test suite from multiple working directories (repo
  root and `/tmp`) to rule out a CWD assumption — both pass.
- Diffed the `FORBIDDEN_TERMS` array against `universal-till`'s guard —
  byte-for-byte identical.
- Confirmed in code (not just in the header comment) that the
  `compliance-claim:allow` hatch is disabled specifically for `site/i18n.js`
  and enabled for the other three surfaces, and that the test suite proves
  both directions.
- Confirmed the fail-closed-per-surface behaviour with three dedicated empty-
  dir test cases.
- Cross-checked the chosen surfaces against the real tree for a plausible
  gap (`site/staticwebapp.config.json`, `src/lib/blogPosts.ts`,
  `README.md`/`package.json`, per-page `description` meta) and found nothing
  else carries prose copy that isn't already scanned.
- Re-ran `node scripts/check-i18n-keys.js`, `bash scripts/check-brand-assets.sh`
  and `npm run build` — all green, `dist/` untouched by `git status` after
  build.

**Two nits, both accepted as-is (not worth a follow-up commit):**
1. `site/i18n.js`'s hatch exclusion is a deliberate policy call, not a
   technical necessity (`.js` does support `//` comments) — already
   documented in the script's own header and locked in by a passing test, so
   left as designed.
2. The test script's scratch file goes to `/tmp/guard_compliance_test_out.$$`
   rather than under its own `$TMPDIR` — inherited verbatim from
   `universal-till`'s precedent test script, not a regression introduced
   here; CI runners are ephemeral, so accepted.

## Verification

| Check | Result |
|---|---|
| `bash scripts/guard-compliance-claims.sh` (real tree) | ✓ 18 files scanned, no forbidden claims |
| `bash scripts/guard-compliance-claims_test.sh` | ✓ all 30 assertions pass |
| `node scripts/check-i18n-keys.js` | ✓ OK (5 locales, 169 keys) |
| `bash scripts/check-brand-assets.sh` | ✓ exit 0 |
| `npm ci && npm run build` | ✓ 20 pages built, no errors |
| `site/` → `dist/` byte-for-byte copy | ✓ (existing `build` CI job's own check, unaffected by this diff) |
| Independent reviewer re-run of all of the above from a different cwd | ✓ matches |

No real client/shop name or secret-shaped literal introduced.

## Not done here

- Extracting the forbidden-terms list to a single shared location instead of
  duplicating it across `universal-till` and `ut-website` — the source
  card's own acceptance criteria explicitly defers this ("revisit if a third
  [repo] ever needs it").
- No ADR needed — this ports an already-approved (ut-docs#667/ADR-0040)
  policy into a mechanical CI check, not a new architectural or business
  decision.
