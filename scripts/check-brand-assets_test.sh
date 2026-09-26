#!/usr/bin/env bash
# Tests for scripts/check-brand-assets.sh (ut-docs#476): the logo ratio check
# must cover the Astro layout, not only site/*.html.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/.." && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*"; exit 1; }

# A fixture tree: the real logo, one plain-HTML page, one Astro layout.
fixture() {
  local root="$1" astro_img="$2"
  mkdir -p "$root/site" "$root/src/layouts"
  cp "$repo/site/logo.svg" "$root/site/logo.svg"
  echo '<img src="/logo.svg" alt="" width="22" height="30">' > "$root/site/index.html"
  echo "$astro_img" > "$root/src/layouts/BaseLayout.astro"
}
run() { BRAND_ASSETS_ROOT="$1" bash "$here/check-brand-assets.sh" 2>"$tmp/err"; }

fixture "$tmp/good" '<img src="/logo.svg" alt="" width="22" height="30" />'
run "$tmp/good" || fail "a correct portrait pair in the Astro layout must pass: $(cat "$tmp/err")"

# The pair that shipped on /blog and /plugins (ut-docs#476).
fixture "$tmp/bad" '<img src="/logo.svg" alt="" width="34" height="30" />'
if run "$tmp/bad"; then fail "a landscape 34x30 pair in src/**/*.astro must fail"; fi
grep -q 'BaseLayout.astro' "$tmp/err" || fail "the failure must name the Astro file: $(cat "$tmp/err")"

# A layout the pattern no longer matches must not pass by checking nothing.
fixture "$tmp/none" '<img src="/logo.svg" alt="Universal Till" />'
if run "$tmp/none"; then fail "no matched Astro logo must fail, not pass silently"; fi
grep -q 'no logo <img> found under src' "$tmp/err" || fail "must say why: $(cat "$tmp/err")"

echo "check-brand-assets_test: OK"
