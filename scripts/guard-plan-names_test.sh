#!/usr/bin/env bash
#
# Regression test for guard-plan-names.sh (ut-docs#4586): each retired plan
# name is caught on every surface, the new names and ordinary prose pass, the
# same-line allow marker works except in site/i18n.js, and a surface that goes
# empty fails closed.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"
GUARD="scripts/guard-plan-names.sh"
FAIL_COUNT=0
TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT

mk() { # mk TAG -> sets I H A C to a clean fixture set
  local t="$1"
  I="${TMPDIR}/${t}_i18n.js"; H="${TMPDIR}/${t}_html"; A="${TMPDIR}/${t}_astro"; C="${TMPDIR}/${t}_content"
  mkdir -p "$H" "$A" "$C"
  printf 'const I18N = { "en-gb": { "plan.a": "Multi-location", "plan.b": "Enterprise and chains", "x": "supply chain" } };\n' >"$I"
  echo '<p>Multi-location and Enterprise and chains.</p>' >"$H/p.html"
  echo '<p>Local Plus.</p>' >"$A/p.astro"
  printf -- '---\ntitle: "Plans"\n---\nA chain store needs Multi-location.\n' >"$C/p.mdx"
}
run() { bash "${GUARD}" "$I" "$H" "$A" "$C" >/dev/null 2>&1; }
pass() { if run; then echo "✓ passed $1"; else echo "❌ FAIL: rejected $1" >&2; FAIL_COUNT=$((FAIL_COUNT + 1)); fi; }
fail() { if run; then echo "❌ FAIL: accepted $1" >&2; FAIL_COUNT=$((FAIL_COUNT + 1)); else echo "✓ rejected $1"; fi; }

mk ok; pass "the new plan names and ordinary prose"

mk i1; printf 'const I18N = { "en-gb": { "plan.a": "Chain" } };\n' >"$I"; fail "Chain in site/i18n.js"
mk i2; printf 'const I18N = { "en-gb": { "plan.a": "Enterprise" } };\n' >"$I"; fail "plain Enterprise in site/i18n.js"
mk i3; printf 'const I18N = { "x": "Chain" }; // plan-name:allow\n' >"$I"; fail "the allow marker in site/i18n.js (not honoured)"
mk h1; echo '<th>Chain</th>' >"$H/p.html"; fail "Chain in a marketing page"
mk h2; echo '<th>Enterprise</th>' >"$H/p.html"; fail "Enterprise in a marketing page"
mk a1; echo '<p>Chain plan</p>' >"$A/p.astro"; fail "Chain in an Astro page"
mk c1; echo 'The Enterprise plan.' >>"$C/p.mdx"; fail "Enterprise in a blog post"
mk c2; echo 'We renamed Chain to Multi-location. <!-- plan-name:allow explaining the rename -->' >>"$C/p.mdx"; pass "an allow-marked exception in a blog post"
mk e1; rm "$H"/*.html; fail "an empty html dir"
mk e2; rm "$A"/*.astro; fail "an empty astro dir"
mk e3; rm "$C"/*.mdx; fail "an empty content dir"

if bash "${GUARD}" >/dev/null 2>&1; then echo "✓ passed the real repo tree"; else echo "❌ FAIL: real tree rejected" >&2; FAIL_COUNT=$((FAIL_COUNT + 1)); fi

[ "${FAIL_COUNT}" -eq 0 ] || { echo "${FAIL_COUNT} guard-plan-names_test.sh assertion(s) failed" >&2; exit 1; }
echo "✓ guard-plan-names_test.sh: all assertions passed"
