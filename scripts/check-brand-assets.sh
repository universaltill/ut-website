#!/usr/bin/env bash
set -euo pipefail

# BRAND_ASSETS_ROOT lets scripts/check-brand-assets_test.sh point this at a
# fixture tree; CI never sets it.
root="${BRAND_ASSETS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
canonical="$root/site/logo.svg"

# The artwork the product owner supplied for ut-docs#290, mirrored from
# ut-docs/logo/unitill-logo.svg. Assert the content, not just the filename:
# the first attempt at that card shipped the previous logo under a new name
# and every check that day matched on filenames alone, so it passed. The
# website was declared "already byte-identical" on that basis and never
# updated. Keep this hash in step with ut-docs/scripts/check-brand-assets.sh.
CANONICAL_SHA256="d4816d6daa622b47d3cb160058ec7368dd6e45800624e0855688d0e50d228221"

test -s "$canonical"

# sha256sum on Linux/CI, shasum on macOS — neither is present on both.
if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$canonical" | cut -d' ' -f1)"
else
  actual="$(shasum -a 256 "$canonical" | cut -d' ' -f1)"
fi
if [ "$actual" != "$CANONICAL_SHA256" ]; then
  echo "site/logo.svg does not match the canonical supplied mark." >&2
  echo "  expected $CANONICAL_SHA256" >&2
  echo "  actual   $actual" >&2
  exit 1
fi

# The mark is portrait (54x73, aspect ~0.7397). Every <img> pins both width
# and height as a layout-shift hint, so a stale landscape pair would squash
# it. Allow 5% drift from the true ratio to leave room for rounding.
# The Astro pages (/blog, /plugins) draw their logo from src/**/*.astro, not
# site/*.html — a 34x30 pair there once rendered the header ~54% taller on
# exactly those pages with this check still green (ut-docs#476).
fail=0
html_checked=0
astro_checked=0
while IFS= read -r line; do
  file="${line%%:*}"
  rest="${line#*:}"
  case "$file" in
    *.astro) astro_checked=$((astro_checked + 1)) ;;
    *) html_checked=$((html_checked + 1)) ;;
  esac
  w="$(printf '%s' "$rest" | sed -E 's/.*width="([0-9]+)".*/\1/')"
  h="$(printf '%s' "$rest" | sed -E 's/.*height="([0-9]+)".*/\1/')"
  ratio="$(awk -v w="$w" -v h="$h" 'BEGIN{printf "%.4f", w/h}')"
  if awk -v r="$ratio" 'BEGIN{exit !(r < 0.703 || r > 0.777)}'; then
    echo "${file#"$root"/}: logo <img> is ${w}x${h} (ratio $ratio); the mark is portrait ~0.74" >&2
    fail=1
  fi
done < <(grep -Hn 'logo\.svg" alt="" width=' "$root"/site/*.html; grep -rHn --include='*.astro' 'logo\.svg" alt="" width=' "$root"/src)
# A markup change the pattern stops matching would silently check nothing.
if [ "$html_checked" -eq 0 ]; then
  echo "no logo <img> found in site/*.html — the pattern above no longer matches the plain-HTML pages" >&2
  fail=1
fi
if [ "$astro_checked" -eq 0 ]; then
  echo "no logo <img> found under src/**/*.astro — the pattern above no longer matches the Astro layout" >&2
  fail=1
fi
[ "$fail" -eq 0 ]
