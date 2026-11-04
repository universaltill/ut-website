#!/usr/bin/env bash
# Guard (ut-docs#5318): the "Use Universal Till in Claude" page must not claim
# more than ADR-0175 allows (sections 3, 4, 5, 11.3, 12.3, 12.6). It scans
# src/content/connector/** and src/pages/[...lang]/claude.astro.
#
# Denylist: official/certified/approved status, directory listing, other AI
# vendors, security/privacy claims we cannot back, and verbs that say Claude
# acts on its own (it only proposes). The one exempt line is the disclaimer:
# the line right after an MDX comment `{/* claim-ok: disclaimer */}`.
# Required in en-gb, de-de and tr-tr: the marker, the word proposal/Vorschlag/
# oneri, and the "inactive until activated" statement.
#
# Usage: guard-claude-claims.sh [ROOT]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-$(cd "${here}/.." && pwd)}"
export LC_ALL=en_US.UTF-8 2>/dev/null || true

DENY='official(ly)?\b|offiziell|resmi\b|partner|ortak(lık)?\b|verified|certified|zertifiziert|sertifikalı|(approved|endorsed|genehmigt|onaylı)|anthropic-(approved|endorsed)|anthropic (connectors )?directory|listed in|in the claude directory|chatgpt|openai|gemini|gdpr[- ]compliant|dsgvo-konform|kvkk[- ]uyumlu|encrypted|verschlüsselt|şifrelenmiş|\bprivate\b|claude (can |will |may |kann |wird )?(change|update|edit|write|modif|ändert|aktualisiert|bearbeitet|schreibt|ändern|aktualisieren)[a-zäöü]* (your|the|a|any|all|prices|items|settings|data|deine|ihre|die|fiyat)|&(amp;)?shy;|\xc2\xad'

# bash 3.2 safe (no associative arrays)
req_proposal() { case "$1" in en-gb) echo proposal;; de-de) echo Vorschlag;; tr-tr) echo öneri;; esac; }
req_inactive() { case "$1" in en-gb) echo inactive;; de-de) echo inaktiv;; tr-tr) echo 'etkin olmayabilir';; esac; }

fail=0
err() { echo "guard-claude-claims: $*" >&2; fail=1; }

scan() { # scan <file>
  local f="$1" prev="" n=0 line
  while IFS= read -r line || [[ -n "${line}" ]]; do
    n=$((n+1))
    if [[ "${prev}" != *"claim-ok: disclaimer"* ]] && printf '%s\n' "${line}" | grep -qiE "${DENY}"; then
      err "${f}:${n}: ${line}"
    fi
    prev="${line}"
  done <"${f}"
  # Phrases split across lines: collapse the file (exempt line removed) and rescan.
  if awk 'p ~ /claim-ok: disclaimer/ {p=$0; next} {print; p=$0}' "${f}" | tr '\n' ' ' | grep -qiE "${DENY}"; then
    if ! awk 'p ~ /claim-ok: disclaimer/ {p=$0; next} {print; p=$0}' "${f}" | grep -qiE "${DENY}"; then
      err "${f}: denylisted phrase split across lines"
    fi
  fi
}

for loc in en-gb de-de tr-tr; do
  f="${ROOT}/src/content/connector/${loc}/claude.mdx"
  if [[ ! -f "${f}" ]]; then err "missing ${f}"; continue; fi
  marks="$(grep -c 'claim-ok: disclaimer' "${f}" || true)"
  [[ "${marks}" -eq 1 ]] || err "${loc}: exactly one disclaimer marker required, found ${marks}"
  # Required words must appear in prose, not in MDX comments or the exempt line.
  body="$(grep -v '{/\*' "${f}" || true)"
  printf '%s\n' "${body}" | grep -qi -- "$(req_proposal "${loc}")" || err "${loc}: '$(req_proposal "${loc}")' missing (changes are proposals)"
  printf '%s\n' "${body}" | grep -qi -- "$(req_inactive "${loc}")" || err "${loc}: inactive-until-activated statement missing"
done

while IFS= read -r f; do scan "${f}"; done < <(
  { find "${ROOT}/src/content/connector" -name '*.mdx' 2>/dev/null
    ls "${ROOT}/src/pages/[...lang]/claude.astro" 2>/dev/null; } | sort -u)

if [[ "${fail}" -ne 0 ]]; then
  echo "guard-claude-claims: FAILED (ADR-0175 claim limits, ut-docs#5318)" >&2
  exit 1
fi
echo "✓ guard-claude-claims: connector pages clean"
