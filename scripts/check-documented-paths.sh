#!/usr/bin/env bash
# Every filesystem path this site tells a shop owner to run must actually exist
# in the shipped package.
#
# Why this guard exists (ut-docs#541): download.html told users to run
#   sudo /opt/unitill/bin/unitill-kiosk-setup
# for the flagship "dedicated Raspberry Pi till" setup. The package ships that
# script at /usr/lib/unitill/unitill-kiosk-setup — so the documented command
# failed with "No such file or directory", in every locale, and nobody noticed.
# The site and the packaging live in different repos, which is exactly why this
# kind of drift goes unseen: neither repo's tests can see the other's truth.
#
# So we check the real artifact: download the current universal-till release
# .deb and assert every /opt or /usr path the site mentions is inside it.
#
# Arch is irrelevant here — amd64 and arm64 ship an identical file layout — so
# we take amd64 as the cheapest representative.
set -euo pipefail

REPO="${UT_POS_REPO:-universaltill/universal-till}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Collecting paths the site tells users to run"
# Absolute /opt or /usr paths mentioned anywhere in the published marketing
# tree. Trailing punctuation (</code>, quotes, commas, full stops) is stripped;
# a bare directory reference is not a command, so require at least one more
# segment after the top level.
mapfile -t DOCUMENTED < <(
  grep -rhoE '/(opt|usr)/[A-Za-z0-9/_.+-]+' site/ 2>/dev/null \
    | sed -E 's/[.,:;"'"'"')]+$//' \
    | grep -E '^/(opt|usr)/[^/]+/.+' \
    | sort -u
)

if [ "${#DOCUMENTED[@]}" -eq 0 ]; then
  echo "No /opt or /usr paths documented on the site — nothing to verify."
  exit 0
fi

printf '    %s\n' "${DOCUMENTED[@]}"

echo "==> Fetching the current $REPO release package"
# --clobber keeps re-runs idempotent; the pattern pins one asset so a future
# extra .deb in the release cannot make this ambiguous.
if ! gh release download --repo "$REPO" --pattern '*linux_amd64.deb' --dir "$WORK" --clobber 2>"$WORK/gh.err"; then
  echo "ERROR: could not download the release package to verify against." >&2
  sed 's/^/    /' "$WORK/gh.err" >&2
  # Deliberately fail rather than skip. A guard that goes quietly green when it
  # cannot verify is the same silent-pass problem this check was written for.
  exit 1
fi

DEB="$(find "$WORK" -name '*.deb' -print -quit)"
echo "    $(basename "$DEB")"

echo "==> Listing package contents"
# `ar` + `tar` rather than dpkg-deb: works on any runner without dpkg, and the
# leading "./" that tar emits is normalised away below.
ar p "$DEB" data.tar.gz 2>/dev/null | tar tzf - 2>/dev/null | sed 's|^\.||' | sort -u > "$WORK/contents.txt"

if [ ! -s "$WORK/contents.txt" ]; then
  echo "ERROR: could not read the package contents — the .deb layout may have changed." >&2
  exit 1
fi

echo "==> Verifying"
fail=0
for p in "${DOCUMENTED[@]}"; do
  # Match the path itself or anything beneath it (a documented directory is
  # satisfied by the files inside it).
  if grep -qE "^${p}(/|$)" "$WORK/contents.txt"; then
    echo "    OK      $p"
  else
    echo "    MISSING $p" >&2
    fail=1
    # The useful hint is where that same filename actually lives — matching on
    # basename finds a moved file, which is the realistic failure (#541 was
    # exactly this). Listing every package path under /opt or /usr instead
    # buries the answer in hundreds of unrelated template files.
    base="${p##*/}"
    if moved="$(grep -E "/${base}$" "$WORK/contents.txt")" && [ -n "$moved" ]; then
      echo "            did you mean: $(echo "$moved" | head -3 | tr '\n' ' ')" >&2
    fi
  fi
done

if [ "$fail" -ne 0 ]; then
  cat >&2 <<'EOF'

The site instructs users to run a path the package does not ship.
Either correct the path on the site — including every locale in site/i18n.js,
since a translated copy of a wrong command is still wrong — or ship it in the
package.
EOF
  exit 1
fi

echo "All documented paths exist in the shipped package."
