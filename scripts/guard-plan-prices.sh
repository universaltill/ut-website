#!/usr/bin/env bash
#
# Guard: public plan prices have ONE source (ut-docs#4193, owner decision
# 2026-10-24). ut-docs reference/plan-prices.json is the source; data/plan-prices.json
# is the vendored copy; site/plan-prices.js is generated from the copy.
#   1. no retired price (Shop 42, Pro 59, Multi-location 127 and their annual
#      per-month figures 35.00 / 49.17 / 105.83) appears in site/ or src/;
#   2. site/plan-prices.js is up to date with data/plan-prices.json;
#   3. optional: data/plan-prices.json is byte-identical to ut-docs main's file when
#      PLAN_PRICES_UPSTREAM points at it (a local run in the ecosystem folder:
#        git -C ../ut-docs show origin/main:reference/plan-prices.json > /tmp/up.json
#      ). CI does NOT hold a token for ut-docs: it is private and this repo is
#      public (no private-repo credential in a public repo). The CI direction is
#      reversed instead: a ut-docs workflow compares its file with this repo's
#      public data/plan-prices.json (ut-docs card filed with this change).
#
# Needs GNU grep (-P). Explicit-args form for tests: $1 = dir to scan for retired
# prices, $2 = data file, $3 = ut-docs file to compare with ("" = fetch / skip).
set -euo pipefail
export LC_ALL=C.UTF-8
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN="${1:-}"; DATA="${2:-$ROOT/data/plan-prices.json}"; UPSTREAM="${3-${PLAN_PRICES_UPSTREAM:-}}"
GREP=grep; command -v ggrep >/dev/null 2>&1 && GREP=ggrep
if ! echo x | "$GREP" -qP x 2>/dev/null; then echo "❌ plan-prices guard: needs GNU grep with -P (brew install grep -> ggrep)" >&2; exit 2; fi
failed=0

# --- 1. retired prices -------------------------------------------------------
PATTERN='(?:[€£]|\b(?:EUR|GBP)\s?)\s?(42|59|127)(?![\d]|[.,]\d*[1-9])|(?<![\d.,])(42|59|127)(?:[.,]00)?\s?(€|£|EUR\b|GBP\b|pounds|euros?\b)|(?<![\d.,])(42|59|127)\s?(/|per |a )(month|mo\b)|(?<![\d.,])(35[.,]00|49[.,]17|105[.,]83)(?![\d])'
dirs=("$ROOT/site" "$ROOT/src")
[ -n "$SCAN" ] && dirs=("$SCAN")
hits="$($GREP -rnP --include='*.html' --include='*.js' --include='*.mjs' --include='*.ts' --include='*.astro' --include='*.mdx' --include='*.md' --include='*.json' "$PATTERN" "${dirs[@]}" || true)"
if [ -n "$hits" ]; then
  echo "❌ plan-prices guard: a retired price is on the site (Shop 42 / Pro 59 / Multi-location 127 / 35.00 / 49.17 / 105.83):" >&2
  echo "$hits" | cut -c1-200 >&2
  failed=1
fi

# --- 2. generated script in sync ----------------------------------------------
if [ -z "$SCAN" ]; then
  node "$ROOT/scripts/gen-plan-prices.mjs" --check || failed=1
fi

# --- 3. identical to ut-docs main ---------------------------------------------
if [ -n "$UPSTREAM" ]; then
  [ -f "$UPSTREAM" ] || { echo "❌ plan-prices guard: upstream file $UPSTREAM not found" >&2; exit 1; }
  if ! cmp -s "$DATA" "$UPSTREAM"; then
    echo "❌ plan-prices guard: data/plan-prices.json differs from ut-docs main reference/plan-prices.json. Copy it, run node scripts/gen-plan-prices.mjs." >&2
    failed=1
  fi
fi

[ "$failed" -eq 0 ] && echo "✓ plan-prices guard: clean"
exit "$failed"
