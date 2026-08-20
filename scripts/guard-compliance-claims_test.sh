#!/usr/bin/env bash
#
# Regression test for guard-compliance-claims.sh (ut-docs#702): proves the
# guard catches each forbidden term from the product-owner-approved list
# (ut-docs#667, approved 2026-08-13) in site/i18n.js, a blog .mdx post, a
# site/*.html marketing page, and a src/**/*.astro page — case-insensitively,
# and catching the German forms specifically. Also proves a permitted phrase
# is never flagged, that the same-line `compliance-claim:allow` escape hatch
# works on every surface except i18n.js, and that each surface fails closed
# on its own. Mirrors universal-till/scripts/ci/guard-compliance-claims_test.sh.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

GUARD="scripts/guard-compliance-claims.sh"
FAIL_COUNT=0

TMPDIR="$(mktemp -d)"
trap 'rm -rf "${TMPDIR}"' EXIT

fresh_dirs() {
  local tag="$1"
  local blog="${TMPDIR}/blog_${tag}"
  local html="${TMPDIR}/html_${tag}"
  local astro="${TMPDIR}/astro_${tag}"
  mkdir -p "${blog}" "${html}" "${astro}"
  printf '%s\n%s\n%s\n' "${blog}" "${html}" "${astro}"
}

expect_pass() {
  local label="$1" locales="$2" blog="$3" html="$4" astro="$5"
  if bash "${GUARD}" "${locales}" "${blog}" "${html}" "${astro}" >/tmp/guard_compliance_test_out.$$ 2>&1; then
    echo "✓ guard correctly passed ${label}"
  else
    echo "❌ FAIL: expected guard to pass ${label}, but it rejected it" >&2
    cat /tmp/guard_compliance_test_out.$$ >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  rm -f /tmp/guard_compliance_test_out.$$
}

expect_fail() {
  local label="$1" locales="$2" blog="$3" html="$4" astro="$5"
  if bash "${GUARD}" "${locales}" "${blog}" "${html}" "${astro}" >/tmp/guard_compliance_test_out.$$ 2>&1; then
    echo "❌ FAIL: expected guard to reject ${label}, but it passed" >&2
    cat /tmp/guard_compliance_test_out.$$ >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "✓ guard correctly rejected ${label}"
  fi
  rm -f /tmp/guard_compliance_test_out.$$
}

# A clean, minimal fixture set using only permitted phrasing (the exact
# ut-docs#667-approved examples) — must pass.
read -r blog_ok html_ok astro_ok <<<"$(fresh_dirs ok | tr '\n' ' ')"
loc_ok="${TMPDIR}/i18n_ok.js"
cat >"${loc_ok}" <<'EOF'
const I18N = {
  "en-gb": {
    "fiscal.tse.summary": "Signs every transaction using a BSI-certified technical security device (TSE).",
    "fiscal.export": "Exports DSFinV-K data for a cash audit.",
    "fiscal.notification_prep": "Prepares the information you need for your §146a Abs. 4 AO notification.",
  },
};
EOF
cat >"${blog_ok}/fiscal-tse.mdx" <<'EOF'
---
title: "Fiscal signing, explained"
---
Universal Till provides a certified TSE and the required exports. It does not
provide tax or legal advice, and your own record-keeping and reporting
obligations remain yours.
EOF
cat >"${html_ok}/fiscal.html" <<'EOF'
<p>Works with a Swissbit hardware TSE or a TSE-equipped printer.</p>
EOF
cat >"${astro_ok}/fiscal.astro" <<'EOF'
<p>Includes a cloud TSE — no separate hardware or contract needed.</p>
EOF
expect_pass "a fixture set using only the approved permitted phrasing" "${loc_ok}" "${blog_ok}" "${html_ok}" "${astro_ok}"

# Each forbidden term, planted one at a time in site/i18n.js, must be caught
# — including the German forms, case-varied to prove insensitivity.
declare -a FORBIDDEN_CASES=(
  "GoBD-compliant"
  "GoBD-konform"
  "KassenSichV-compliant"
  "KassenSichV-konform"
  "FINANZAMTSKONFORM"
  "Audit-Proof"
  "revisionssicher"
  "Certified by the Finanzamt"
  "vom Finanzamt zertifiziert"
  "Approved by the Tax Office"
  "You Are Compliant"
  "fully compliant"
  "We file your §146a notification for you"
  "We submit your §146a notification for you"
  "We will file your §146a notification"
  "We handle your §146a filing so you don't have to"
  "We take care of your §146a for you"
  "Wir melden Ihre Kasse beim Finanzamt"
  "Wir reichen Ihre §146a Anmeldung ein"
  # The one term with a cased non-ASCII character (Ü) — pins the ut-docs#662-
  # class locale bug: `grep -i` only folds Ü→ü in a UTF-8 locale, and CI
  # runners often have no LANG set (the C locale) — without this guard
  # forcing LC_ALL=C.UTF-8 itself, this exact capitalized German heading
  # would ship past CI undetected.
  "WIR ÜBERNEHMEN IHRE §146A-ANMELDUNG"
)
for term in "${FORBIDDEN_CASES[@]}"; do
  loc="${TMPDIR}/i18n_term_$(echo "$term" | tr -cd 'a-zA-Z0-9').js"
  printf 'const I18N = { "en-gb": { "x.claim": "%s" } };\n' "$term" >"${loc}"
  expect_fail "the forbidden term ${term@Q} in site/i18n.js" "${loc}" "${blog_ok}" "${html_ok}" "${astro_ok}"
done

# The same forbidden term in a blog post, a marketing page and an Astro page
# must also be caught — the guard's surfaces are independent, not just
# site/i18n.js exercised above. Every fixture dir below carries a legitimate
# baseline file too, so the per-surface fail-closed check can never make
# expect_fail pass for the wrong reason — vacuously, from an empty sibling
# dir, rather than genuinely detecting the planted term.
read -r blog_blog html_blog astro_blog <<<"$(fresh_dirs blog_surface | tr '\n' ' ')"
cat >"${blog_blog}/claim.mdx" <<'EOF'
---
title: "Our till is fully GoBD-compliant out of the box"
---
See title.
EOF
cp "${html_ok}"/*.html "${html_blog}/"
cp "${astro_ok}"/*.astro "${astro_blog}/"
expect_fail "a forbidden term in a blog post" "${loc_ok}" "${blog_blog}" "${html_blog}" "${astro_blog}"

read -r blog_html html_html astro_html <<<"$(fresh_dirs html_surface | tr '\n' ' ')"
cp "${blog_ok}"/*.mdx "${blog_html}/"
echo '<p>revisionssicher, garantiert.</p>' >"${html_html}/claim.html"
cp "${astro_ok}"/*.astro "${astro_html}/"
expect_fail "a forbidden term in a marketing page" "${loc_ok}" "${blog_html}" "${html_html}" "${astro_html}"

read -r blog_astro html_astro astro_astro <<<"$(fresh_dirs astro_surface | tr '\n' ' ')"
cp "${blog_ok}"/*.mdx "${blog_astro}/"
cp "${html_ok}"/*.html "${html_astro}/"
echo '<p>Certified by the Finanzamt.</p>' >"${astro_astro}/claim.astro"
expect_fail "a forbidden term in an Astro page" "${loc_ok}" "${blog_astro}" "${html_astro}" "${astro_astro}"

# compliance-claim:allow escape hatch — a reviewed exception (e.g. this very
# guard's own test data, or a blog post explaining why a term is forbidden)
# must not fail the build when marked, on the blog/html/astro surfaces
# (site/i18n.js is NOT covered — documented gap, see the guard's own header).
read -r blog_allow html_allow astro_allow <<<"$(fresh_dirs allow | tr '\n' ' ')"
cat >"${blog_allow}/claim.mdx" <<'EOF'
---
title: "What we never claim"
---
We never claim "GoBD-compliant" anywhere in the product. <!-- compliance-claim:allow quoting the forbidden term to explain why we avoid it -->
EOF
cp "${html_ok}"/*.html "${html_allow}/"
cp "${astro_ok}"/*.astro "${astro_allow}/"
expect_pass "a forbidden term with a same-line compliance-claim:allow marker" "${loc_ok}" "${blog_allow}" "${html_allow}" "${astro_allow}"

# A forbidden term in site/i18n.js with a same-line marker must still fail —
# the escape hatch does not apply to that surface.
loc_allow_denied="${TMPDIR}/i18n_allow_denied.js"
printf 'const I18N = { "en-gb": { "x.claim": "GoBD-compliant" } }; // compliance-claim:allow\n' >"${loc_allow_denied}"
expect_fail "a forbidden term in site/i18n.js with a compliance-claim:allow marker (not honoured on this surface)" "${loc_allow_denied}" "${blog_ok}" "${html_ok}" "${astro_ok}"

# Missing locales file entirely — fail closed, don't silently pass.
expect_fail "a nonexistent locales file" "${TMPDIR}/does-not-exist.js" "${blog_ok}" "${html_ok}" "${astro_ok}"

# Fail closed PER SURFACE: one surface going empty (renamed extension, moved
# tree) must fail on its own — not only when every surface vanishes together.
read -r blog_empty1 html_empty1 astro_empty1 <<<"$(fresh_dirs empty_blog | tr '\n' ' ')"
cp "${html_ok}"/*.html "${html_empty1}/"
cp "${astro_ok}"/*.astro "${astro_empty1}/"
expect_fail "an empty blog dir alone (html+astro populated)" "${loc_ok}" "${blog_empty1}" "${html_empty1}" "${astro_empty1}"

read -r blog_empty2 html_empty2 astro_empty2 <<<"$(fresh_dirs empty_html | tr '\n' ' ')"
cp "${blog_ok}"/*.mdx "${blog_empty2}/"
cp "${astro_ok}"/*.astro "${astro_empty2}/"
expect_fail "an empty html dir alone (blog+astro populated)" "${loc_ok}" "${blog_empty2}" "${html_empty2}" "${astro_empty2}"

read -r blog_empty3 html_empty3 astro_empty3 <<<"$(fresh_dirs empty_astro | tr '\n' ' ')"
cp "${blog_ok}"/*.mdx "${blog_empty3}/"
cp "${html_ok}"/*.html "${html_empty3}/"
expect_fail "an empty astro dir alone (blog+html populated)" "${loc_ok}" "${blog_empty3}" "${html_empty3}" "${astro_empty3}"

# The real, unmodified tree must still pass (no forbidden claims shipped yet).
expect_pass "the real repo tree" "site/i18n.js" "src/content/blog" "site" "src"

if [ "${FAIL_COUNT}" -ne 0 ]; then
  echo "${FAIL_COUNT} guard-compliance-claims_test.sh assertion(s) failed" >&2
  exit 1
fi
echo "✓ guard-compliance-claims_test.sh: all assertions passed"
