#!/usr/bin/env bash
# Serve till installers straight from GitHub releases (ut-docs#2489). Nothing
# is copied onto the site: each stable /downloads/<name> path is a 302 to the
# versioned release asset, which GitHub sends as an attachment — so a click
# starts the download immediately. latest.json lists the same GitHub URLs.
# Copying the installers here outgrew Azure SWA's 250MB cap (ut-docs#2486).
#
# usage: download-redirects.sh <version> <file-listing-release-asset-names> <site-dir>
set -euo pipefail
ver=$1 assets=$2 site=$3
gh="https://github.com/universaltill/universal-till/releases/download/v$ver"
cfg="$site/staticwebapp.config.json"
mkdir -p "$site/downloads"

# manifest key | stable path under /downloads/ | versioned release asset name
entries="windows_setup|unitill-pos-setup.exe|unitill-pos-setup-${ver}.exe
windows_amd64|unitill-pos_windows_amd64.zip|unitill-pos_${ver}_windows_amd64.zip
darwin_dmg|unitill-pos-macOS-arm64.dmg|unitill-pos-${ver}-macOS-arm64.dmg
darwin_arm64|unitill-pos_darwin_arm64.tar.gz|unitill-pos_${ver}_darwin_arm64.tar.gz
linux_arm64_deb|unitill-pos_linux_arm64.deb|unitill-pos_${ver}_linux_arm64.deb
linux_arm64_tar|unitill-pos_linux_arm64.tar.gz|unitill-pos_${ver}_linux_arm64.tar.gz
linux_amd64_deb|unitill-pos_linux_amd64.deb|unitill-pos_${ver}_linux_amd64.deb
linux_amd64_tar|unitill-pos_linux_amd64.tar.gz|unitill-pos_${ver}_linux_amd64.tar.gz
android|unitill-pos_android.apk|unitill-pos_${ver}_android.apk"

downloads='{}' routes='[]'
while IFS='|' read -r key stable asset; do
  if ! grep -qxF "$asset" "$assets"; then
    downloads=$(jq --arg k "$key" '.[$k]=null' <<<"$downloads"); echo "missing   $asset"; continue
  fi
  downloads=$(jq --arg k "$key" --arg u "$gh/$asset" '.[$k]=$u' <<<"$downloads")
  routes=$(jq --arg r "/downloads/$stable" --arg u "$gh/$asset" '.+[{route:$r,redirect:$u,statusCode:302}]' <<<"$routes")
  echo "redirect  /downloads/$stable -> $asset"
done <<<"$entries"

# Redirects go first so they win over any catch-all route.
jq --argjson r "$routes" '.routes = ($r + (.routes // []))' "$cfg" >"$cfg.tmp" && mv "$cfg.tmp" "$cfg"
jq -n --arg v "$ver" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson d "$downloads" \
  '{version:$v, released:$t, downloads:$d}' >"$site/downloads/latest.json"
