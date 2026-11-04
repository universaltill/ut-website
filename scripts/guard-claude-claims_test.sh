#!/usr/bin/env bash
# Tests for guard-claude-claims.sh (ut-docs#5318): a clean fixture passes,
# every denylisted claim fails, the disclaimer marker exempts only the line
# after it, and each required element missing in a locale fails.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="${here}/guard-claude-claims.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
fails=0

mk() { # mk <root>  -> clean three-locale fixture
  local r="$1" l
  for l in en-gb:proposal:inactive de-de:Vorschlag:inaktiv tr-tr:öneri:"etkin olmayabilir"; do
    IFS=: read -r loc prop inact <<<"$l"
    mkdir -p "$r/src/content/connector/$loc" "$r/src/pages/[...lang]"
    cat >"$r/src/content/connector/$loc/claude.mdx" <<EOT
---
title: "x"
---

<h2 id="activation">A</h2>

A $prop is shown. The connection stays $inact until activated.

{/* claim-ok: disclaimer */}
Universal Till is not affiliated with or endorsed by Anthropic.
EOT
  done
  printf '<p>page</p>\n' >"$r/src/pages/[...lang]/claude.astro"
}

expect() { # expect <pass|fail> <name> <root>
  local want="$1" name="$2" root="$3" rc=0
  bash "$GUARD" "$root" >/dev/null 2>&1 || rc=$?
  if { [[ $want == pass && $rc -eq 0 ]] || [[ $want == fail && $rc -ne 0 ]]; }; then
    echo "ok   $name"
  else
    echo "FAIL $name (want $want, rc=$rc)"; fails=$((fails+1))
  fi
}

n=0
fresh() { n=$((n+1)); R="$TMP/r$n"; mk "$R"; }

fresh; expect pass "clean fixture" "$R"

bad=("Universal Till is an official integration." "We are certified." "Approved by Anthropic." \
  "Listed in the Anthropic Connectors Directory." "Available in the Claude directory." \
  "Also works with ChatGPT." "Also OpenAI." "Also Gemini." "It is GDPR-compliant." \
  "Data is encrypted." "Your data stays private." "Claude changes your prices." \
  "Claude writes items." "Der Zugriff ist DSGVO-konform." "Ein offizieller Partner." "Resmi entegrasyon." "An official Anthropic connector." "Ein offizieller Anthropic-Partner." "Anthropic-approved." "An Anthropic partner." "Verified by Anthropic." "Officially supported by Claude." "Claude can update your prices." "Claude will change prices." "Claude modifies items." "certi&shy;fied")
for b in "${bad[@]}"; do
  fresh; printf '\n%s\n' "$b" >>"$R/src/content/connector/en-gb/claude.mdx"
  expect fail "denies: $b" "$R"
done

fresh; printf '\nWe are certified.\n' >>"$R/src/pages/[...lang]/claude.astro"
expect fail "scans claude.astro" "$R"

fresh; sed -i.bak 's/is not affiliated with or endorsed by Anthropic/is certified by Anthropic/' "$R/src/content/connector/en-gb/claude.mdx"
expect pass "marker exempts the next line" "$R"
fresh; sed -i.bak 's/is not affiliated with or endorsed by Anthropic\./is not affiliated.\nWe are certified./' "$R/src/content/connector/en-gb/claude.mdx"; : >>"$R/src/content/connector/en-gb/claude.mdx"
expect fail "marker exempts only one line" "$R"

fresh; printf '\nAn official\nintegration.\n' >>"$R/src/content/connector/en-gb/claude.mdx"
expect fail "phrase split across lines" "$R"
fresh; printf '\n{/* claim-ok: disclaimer */}\nWe are the official integration.\n' >>"$R/src/content/connector/en-gb/claude.mdx"
expect fail "second marker rejected" "$R"
fresh; sed -i.bak '/claim-ok/,$d' "$R/src/content/connector/tr-tr/claude.mdx"
expect fail "missing disclaimer in tr" "$R"
fresh; sed -i.bak 's/Vorschlag/Idee/' "$R/src/content/connector/de-de/claude.mdx"
expect fail "missing Vorschlag in de" "$R"
fresh; sed -i.bak 's/öneri/fikir/' "$R/src/content/connector/tr-tr/claude.mdx"
expect fail "missing öneri in tr" "$R"
fresh; sed -i.bak 's/proposal/idea/' "$R/src/content/connector/en-gb/claude.mdx"
expect fail "missing proposal in en" "$R"
fresh; sed -i.bak 's/inactive/dormant/' "$R/src/content/connector/en-gb/claude.mdx"
expect fail "missing inactive-until-activated in en" "$R"
fresh; rm "$R/src/content/connector/de-de/claude.mdx"
expect fail "missing locale file" "$R"

[[ $fails -eq 0 ]] && echo "guard-claude-claims_test: all tests passed" || { echo "$fails failed"; exit 1; }
