#!/usr/bin/env bash
# Stage release installers onto our own domain within a byte budget
# (ut-docs#2486). Azure Static Web Apps (free) rejects the whole deploy past
# 250MB, and the installers grew to ~50MB each, so mirroring all of them
# broke every deploy. Mirror in priority order while they fit; everything
# else gets a 302 route to its GitHub release asset, so no /downloads/ link
# ever 404s. The APK (~110–180MB) is never mirrored.
#
# usage: stage-downloads.sh <version> <release-asset-dir> <site-dir> <budget-bytes>
set -euo pipefail
ver=$1 rel=$2 site=$3 budget=$4
gh="https://github.com/universaltill/universal-till/releases/download/v$ver"
cfg="$site/staticwebapp.config.json"
mkdir -p "$site/downloads"

# manifest key | asset suffix — highest priority first (Windows, macOS, Pi).
entries="windows_amd64|windows_amd64.zip
darwin_arm64|darwin_arm64.tar.gz
linux_arm64_deb|linux_arm64.deb
linux_amd64_deb|linux_amd64.deb
linux_amd64_tar|linux_amd64.tar.gz
linux_arm64_tar|linux_arm64.tar.gz"

used=0 downloads='{}' routes='[]'
while IFS='|' read -r key suffix; do
  src="$rel/unitill-pos_${ver}_${suffix}" stable="unitill-pos_${suffix}"
  if [ ! -f "$src" ]; then
    downloads=$(jq --arg k "$key" '.[$k]=null' <<<"$downloads"); continue
  fi
  size=$(wc -c <"$src" | tr -d ' ')
  if [ $((used + size)) -le "$budget" ]; then
    cp "$src" "$site/downloads/$stable"; used=$((used + size))
    downloads=$(jq --arg k "$key" --arg u "/downloads/$stable" '.[$k]=$u' <<<"$downloads")
    echo "mirrored  $stable ($size bytes)"
  else
    url="$gh/unitill-pos_${ver}_${suffix}"
    downloads=$(jq --arg k "$key" --arg u "$url" '.[$k]=$u' <<<"$downloads")
    routes=$(jq --arg r "/downloads/$stable" --arg u "$url" '.+[{route:$r,redirect:$u,statusCode:302}]' <<<"$routes")
    echo "redirect  $stable -> GitHub (over the ${budget}-byte budget)"
  fi
done <<<"$entries"
downloads=$(jq --arg u "$gh/unitill-pos_${ver}_android.apk" '.android=$u' <<<"$downloads")

# Redirects go first so they win over any catch-all route.
jq --argjson r "$routes" '.routes = ($r + (.routes // []))' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"
jq -n --arg v "$ver" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson d "$downloads" \
  '{version:$v, released:$t, downloads:$d}' >"$site/downloads/latest.json"
echo "staged $used of $budget bytes for v$ver"
