#!/usr/bin/env bash
#
# Guard: the website never names a plan by its retired names (ut-docs#4586).
# ADR-0060's 2026-10-17 amendment renamed the "Chain" plan to "Multi-location"
# and "Enterprise" to "Enterprise and chains" (the plan id stays `chain`).
# Marketing copy, comparison tables and blog posts must use the new names, so
# the generated pricing source (ut-docs#729) and any page written from the old
# wording fail here instead of shipping.
#
# Scans the same surfaces as guard-compliance-claims.sh: site/i18n.js,
# site/*.html, src/**/*.astro and src/content/**/*.mdx. The match is
# case-sensitive on purpose: lower-case "supply chain" or "chain store" is
# ordinary prose; the plan name is the capitalised word. A reviewed exception
# (a blog post explaining the rename) carries a same-line
# `plan-name:allow <reason>`; it is not honoured in site/i18n.js, where a
# false positive means rewriting the string.
#
# Explicit-args form for fixture-based testing: args are i18n file, html dir,
# astro dir, content dir.
set -euo pipefail
export LC_ALL=C.UTF-8

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCALES_FILE="${1:-${ROOT_DIR}/site/i18n.js}"
HTML_DIR="${2:-${ROOT_DIR}/site}"
ASTRO_DIR="${3:-${ROOT_DIR}/src}"
CONTENT_DIR="${4:-${ROOT_DIR}/src/content}"

[ -f "$LOCALES_FILE" ] || { echo "❌ plan-names guard: ${LOCALES_FILE} does not exist" >&2; exit 1; }
for d in "$HTML_DIR" "$ASTRO_DIR" "$CONTENT_DIR"; do
  [ -d "$d" ] || { echo "❌ plan-names guard: ${d} does not exist" >&2; exit 1; }
done

ALLOW_MARKER="plan-name:allow"
# "Chain" as a word, or "Enterprise" not followed by " and chains".
PATTERN='\bChain\b|\bEnterprise\b(?! and chains)'
failed=0

scan_file() {
  local file="$1" allow_hatch="$2"
  local rel="${file#"${ROOT_DIR}/"}" matches m lineno content
  matches="$(grep -n -P "$PATTERN" "$file" || true)"
  [ -z "$matches" ] && return
  while IFS= read -r m; do
    lineno="${m%%:*}"
    content="${m#*:}"
    if [ "$allow_hatch" = "1" ] && printf '%s' "$content" | grep -qF -- "$ALLOW_MARKER"; then
      continue
    fi
    echo "❌ plan-names guard: ${rel}:${lineno} uses a retired plan name:" >&2
    echo "   ${content}" >&2
    echo "   (ADR-0060 amendment, ut-docs#4586): say \"Multi-location\" / \"Enterprise and chains\"," >&2
    echo "   or mark a reviewed exception with a same-line ${ALLOW_MARKER}." >&2
    failed=1
  done <<<"$matches"
}

scan_file "$LOCALES_FILE" 0
html_checked=0
while IFS= read -r -d '' f; do html_checked=$((html_checked + 1)); scan_file "$f" 1; done \
  < <(find "$HTML_DIR" -maxdepth 1 -name '*.html' -print0)
astro_checked=0
while IFS= read -r -d '' f; do astro_checked=$((astro_checked + 1)); scan_file "$f" 1; done \
  < <(find "$ASTRO_DIR" -name '*.astro' -print0)
content_checked=0
while IFS= read -r -d '' f; do content_checked=$((content_checked + 1)); scan_file "$f" 1; done \
  < <(find "$CONTENT_DIR" -name '*.mdx' -print0)

for pair in "html:$html_checked" "astro:$astro_checked" "content:$content_checked"; do
  if [ "${pair#*:}" -eq 0 ]; then
    echo "❌ plan-names guard: no ${pair%%:*} files found — that surface is no longer being scanned." >&2
    exit 1
  fi
done

[ "$failed" -eq 0 ] || exit 1
echo "✓ plan-names guard: $((1 + html_checked + astro_checked + content_checked)) file(s) scanned, no retired plan names found"
