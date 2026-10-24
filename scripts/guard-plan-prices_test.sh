#!/usr/bin/env bash
# Fixture tests for guard-plan-prices.sh (ut-docs#4193).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
G="$ROOT/scripts/guard-plan-prices.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0
expect() { # name want_rc args...
  local name="$1" want="$2"; shift 2
  "$@" >"$T/out" 2>&1; local rc=$?
  if [ "$rc" -ne "$want" ]; then echo "FAIL $name: rc=$rc want $want"; cat "$T/out"; fail=1; else echo "ok   $name"; fi
}
mkdir -p "$T/ok" "$T/bad"
printf '<p>Shop is €429 €42.50 EUR 420 €29 per month, Pro £49, 120 EUR, 24,17 €, 100.00, 33 a month, 42 stalls, 2042, 1.127</p>\n' > "$T/ok/a.html"
D="$ROOT/data/plan-prices.json"
expect "current prices pass" 0 bash "$G" "$T/ok" "$D" ""
for bad in 'Shop €42' 'Shop £42 a month' 'Pro 59 EUR' 'Pro 59 per month' 'Multi-location 127 €' 'Multi-location $127/month' 'annual 35.00' 'annual 49,17 €' 'annual 105.83' 'Pro 59,00 €' 'Pro €59.00 per month' 'Shop: £42.00/month' 'Multi-location €127.00' 'Pro EUR 59 monthly' 'Shop GBP 42'; do
  printf '<p>%s</p>\n' "$bad" > "$T/bad/a.html"
  expect "retired: $bad" 1 bash "$G" "$T/bad" "$D" ""
done
printf '{"a":1}' > "$T/other.json"
expect "no GNU grep fails loudly" 2 env PATH="$T/nogrep:/usr/bin:/bin" bash -c 'mkdir -p "$0"; [ -x /usr/bin/grep ] && printf "#!/bin/sh\nexit 2\n" > "$0/ggrep" && chmod +x "$0/ggrep"; bash "$1" "$2" "$3" ""' "$T/nogrep" "$G" "$T/ok" "$D"
expect "differs from upstream" 1 bash "$G" "$T/ok" "$D" "$T/other.json"
expect "same as upstream" 0 bash "$G" "$T/ok" "$D" "$D"
exit "$fail"
