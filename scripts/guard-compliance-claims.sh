#!/usr/bin/env bash
#
# Guard: this site's port of universal-till's
# scripts/ci/guard-compliance-claims.sh (ut-docs#702, immediate follow-up to
# ut-docs#681/#667 per that card's own acceptance criteria: "Extend to
# ut-website in the same change or an immediate follow-up — the website is
# the surface most likely to carry marketing claims"). Enforces the same
# product-owner-approved fiscal-compliance wording denylist (ut-docs#667,
# approved 2026-08-13) here too — this is the public marketing site, sales
# copy rather than product UI, so if anything the risk is higher, not lower.
#
# We may describe what the software DOES (a factual capability). We may NOT
# promise a legal OUTCOME, because the outcome depends on how the shop
# actually operates — see universal-till/CLAUDE.md's "Compliance wording"
# section and ADR-0040 for the full rationale; this script only enforces the
# approved list, it does not re-derive the reasoning.
#
# Scans this repo's actual content surfaces (it has no per-locale JSON files
# or web/help,web/ui dirs the way universal-till does — see this repo's own
# README for the real layout):
#   - site/i18n.js               — every locale's UI copy in one file (all
#                                   launch-market languages as keyed
#                                   objects — see the file's own header)
#   - src/content/blog/**/*.mdx  — blog post content, per locale, the
#                                   CMS-editable surface most likely to
#                                   accumulate a claim over time
#   - site/*.html                — the plain-HTML marketing pages
#   - src/**/*.astro             — Astro-rendered pages AND layouts (a
#                                   literal here would bypass data-i18n
#                                   entirely, same blind spot guard-i18n.sh's
#                                   own check 5 documents in universal-till)
#
# Case- and language-insensitive: the German forms are where the actual
# pilot risk sits, not the English ones (ut-docs#667) — deliberate emphasis.
#
# Escape hatch: a same-line `compliance-claim:allow` marker, same convention
# as universal-till's guard — for a reviewed exception, e.g. a blog post
# explaining IN PROSE why we do not use a forbidden term. Does NOT apply to
# site/i18n.js: like universal-till's per-locale JSON, this file holds
# translated UI copy with no legitimate reason to quote a forbidden phrase,
# so a false positive there means rewriting the string, not suppressing the
# check — same rationale as universal-till's own locales-dir exclusion, even
# though .js syntactically supports comments.
#
# Known detection gaps, accepted (same as universal-till's guard, ut-docs#681
# review): this is a line-based literal-substring check, so it cannot see a
# forbidden term split across a line wrap, split by an HTML tag or Astro
# expression, separated by doubled/non-breaking whitespace, or spelled with a
# Unicode look-alike hyphen/dash instead of ASCII "-". Not worth the
# complexity to fix — this checks a denylist, it is not a copy reviewer.
#
# Explicit-args form for fixture-based testing (see
# guard-compliance-claims_test.sh): args are locales file, blog dir, site
# html dir, astro dir.
set -euo pipefail

# ut-docs#662-class locale bug: `grep -i` only case-folds non-ASCII letters
# (e.g. Ü→ü) in a UTF-8 locale. Force UTF-8 regardless of the runner's own
# environment, same fix universal-till's guard already applies — one of the
# 19 forbidden terms has a cased umlaut, and this check exists specifically
# to catch the German forms.
export LC_ALL=C.UTF-8

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCALES_FILE="${ROOT_DIR}/site/i18n.js"
BLOG_DIR="${ROOT_DIR}/src/content/blog"
HTML_DIR="${ROOT_DIR}/site"
ASTRO_DIR="${ROOT_DIR}/src"

if [ "$#" -ge 1 ]; then LOCALES_FILE="$1"; fi
if [ "$#" -ge 2 ]; then BLOG_DIR="$2"; fi
if [ "$#" -ge 3 ]; then HTML_DIR="$3"; fi
if [ "$#" -ge 4 ]; then ASTRO_DIR="$4"; fi

if [ ! -f "$LOCALES_FILE" ]; then
  echo "❌ compliance-claims guard: ${LOCALES_FILE} does not exist" >&2
  exit 1
fi
for d in "$BLOG_DIR" "$HTML_DIR" "$ASTRO_DIR"; do
  if [ ! -d "$d" ]; then
    echo "❌ compliance-claims guard: ${d} does not exist" >&2
    exit 1
  fi
done

# ut-docs#667's approved forbidden list, verbatim — kept in sync BY HAND with
# universal-till/scripts/ci/guard-compliance-claims.sh. Duplicating the list
# across the two repos is fine per ut-docs#702's own acceptance criteria
# ("duplicating is fine for two repos, revisit if a third ever needs it").
FORBIDDEN_TERMS=(
  "gobd-compliant"
  "gobd-konform"
  "kassensichv-compliant"
  "kassensichv-konform"
  "finanzamtskonform"
  "audit-proof"
  "revisionssicher"
  "certified by the finanzamt"
  "vom finanzamt zertifiziert"
  "approved by the tax office"
  "you are compliant"
  "fully compliant"
  "we file your §146a"
  "we submit your §146a"
  "we will file your §146a"
  "we handle your §146a filing"
  "we take care of your §146a"
  "wir melden ihre kasse"
  "wir reichen ihre §146a"
  "wir übernehmen ihre §146a-anmeldung"
)

ALLOW_MARKER="compliance-claim:allow"

failed=0

# One term-per-line pattern file for a single `grep -n -i -F -f` pass per
# scanned file (same rationale as universal-till's guard: a per-line
# tr/grep loop takes minutes over a real tree of any size).
TERMS_FILE="$(mktemp)"
trap 'rm -f "${TERMS_FILE}"' EXIT
printf '%s\n' "${FORBIDDEN_TERMS[@]}" >"${TERMS_FILE}"

# scan_file PATH ALLOW_HATCH — ALLOW_HATCH=1 lets a same-line
# compliance-claim:allow marker suppress a match (blog/html/astro); 0 does
# not (site/i18n.js — see the header comment above for why).
scan_file() {
  local file="$1" allow_hatch="$2"
  local rel="${file#"${ROOT_DIR}/"}"
  local matches lineno content
  matches="$(grep -n -i -F -f "$TERMS_FILE" "$file" || true)"
  [ -z "$matches" ] && return
  while IFS= read -r m; do
    lineno="${m%%:*}"
    content="${m#*:}"
    if [ "$allow_hatch" = "1" ] && printf '%s' "$content" | grep -qF -- "$ALLOW_MARKER"; then
      continue
    fi
    echo "❌ compliance-claims guard: ${rel}:${lineno} contains a forbidden compliance claim:" >&2
    echo "   ${content}" >&2
    echo "   (ut-docs#667 approved wording list — this asserts a legal outcome" >&2
    echo "   we are not entitled to claim). Rephrase as a factual capability," >&2
    echo "   or mark a reviewed exception with a same-line ${ALLOW_MARKER}." >&2
    failed=1
  done <<<"$matches"
}

scan_file "$LOCALES_FILE" 0

# Fail closed PER SURFACE (mirrors universal-till's guard, ut-docs#681
# review finding): one surface going empty (renamed extension, moved tree)
# must fail on its own, not only when every surface vanishes together.
blog_checked=0
while IFS= read -r -d '' f; do
  blog_checked=$((blog_checked + 1))
  scan_file "$f" 1
done < <(find "$BLOG_DIR" -name '*.mdx' -print0)

html_checked=0
while IFS= read -r -d '' f; do
  html_checked=$((html_checked + 1))
  scan_file "$f" 1
done < <(find "$HTML_DIR" -maxdepth 1 -name '*.html' -print0)

astro_checked=0
while IFS= read -r -d '' f; do
  astro_checked=$((astro_checked + 1))
  scan_file "$f" 1
done < <(find "$ASTRO_DIR" -name '*.astro' -print0)

if [ "$blog_checked" -eq 0 ]; then
  echo "❌ compliance-claims guard: no *.mdx files found under ${BLOG_DIR#"${ROOT_DIR}/"} — blog content is no longer being scanned." >&2
  exit 1
fi
if [ "$html_checked" -eq 0 ]; then
  echo "❌ compliance-claims guard: no *.html files found under ${HTML_DIR#"${ROOT_DIR}/"} — marketing pages are no longer being scanned." >&2
  exit 1
fi
if [ "$astro_checked" -eq 0 ]; then
  echo "❌ compliance-claims guard: no *.astro files found under ${ASTRO_DIR#"${ROOT_DIR}/"} — Astro pages/layouts are no longer being scanned." >&2
  exit 1
fi

checked=$((1 + blog_checked + html_checked + astro_checked))

if [ "$failed" -ne 0 ]; then
  exit 1
fi

echo "✓ compliance-claims guard: ${checked} file(s) scanned, no forbidden fiscal-compliance claims found"
