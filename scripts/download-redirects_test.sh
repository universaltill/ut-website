#!/usr/bin/env bash
# Tests for scripts/download-redirects.sh (ut-docs#2489): installers are served
# straight from GitHub releases — every /downloads/ path is a 302, nothing copied.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*"; exit 1; }

site="$tmp/site"; mkdir -p "$site"
echo '{"routes":[{"route":"/en-gb","rewrite":"/index.html"}]}' > "$site/staticwebapp.config.json"
printf '%s\n' unitill-pos_9.9.9_windows_amd64.zip unitill-pos_9.9.9_darwin_arm64.tar.gz \
  unitill-pos_9.9.9_linux_arm64.deb unitill-pos_9.9.9_linux_amd64.deb unitill-pos_9.9.9_linux_amd64.tar.gz \
  unitill-pos_9.9.9_linux_arm64.tar.gz unitill-pos_9.9.9_android.apk \
  unitill-pos_9.9.9_android-arm64.apk unitill-pos_9.9.9_android-armv7.apk unitill-pos-setup-9.9.9.exe unitill-pos-9.9.9-macOS-arm64.dmg > "$tmp/assets"

bash "$here/download-redirects.sh" 9.9.9 "$tmp/assets" "$site" >/dev/null

gh="https://github.com/universaltill/universal-till/releases/download/v9.9.9"
cfg="$site/staticwebapp.config.json"
[ -z "$(find "$site/downloads" -type f ! -name latest.json)" ] || fail "no installer may be copied onto the site"
for s in windows_amd64.zip darwin_arm64.tar.gz linux_arm64.deb linux_amd64.deb linux_amd64.tar.gz linux_arm64.tar.gz android.apk android-arm64.apk android-armv7.apk; do
  r=$(jq -r --arg p "/downloads/unitill-pos_$s" '.routes[]|select(.route==$p)|"\(.redirect) \(.statusCode)"' "$cfg")
  [ "$r" = "$gh/unitill-pos_9.9.9_$s 302" ] || fail "redirect for $s wrong: '$r'"
done
r=$(jq -r '.routes[]|select(.route=="/downloads/unitill-pos-setup.exe")|.redirect' "$cfg")
[ "$r" = "$gh/unitill-pos-setup-9.9.9.exe" ] || fail "Setup.exe redirect wrong: '$r'"
r=$(jq -r '.routes[]|select(.route=="/downloads/unitill-pos-macOS-arm64.dmg")|.redirect' "$cfg")
[ "$r" = "$gh/unitill-pos-9.9.9-macOS-arm64.dmg" ] || fail ".dmg redirect wrong: '$r'"
[ "$(jq -r '.routes[-1].route' "$cfg")" = "/en-gb" ] || fail "existing routes must be kept, after the redirects"
m="$site/downloads/latest.json"
[ "$(jq -r .version "$m")" = 9.9.9 ] || fail "manifest version"
[ "$(jq -r .downloads.windows_amd64 "$m")" = "$gh/unitill-pos_9.9.9_windows_amd64.zip" ] || fail "manifest windows url"
[ "$(jq -r .downloads.android "$m")" = "$gh/unitill-pos_9.9.9_android.apk" ] || fail "manifest android url"
[ "$(jq -r .downloads.android_arm64 "$m")" = "$gh/unitill-pos_9.9.9_android-arm64.apk" ] || fail "manifest android arm64 url"
[ "$(jq -r .downloads.android_armv7 "$m")" = "$gh/unitill-pos_9.9.9_android-armv7.apk" ] || fail "manifest android armv7 url"

# an asset missing from the release gets no route and a null manifest entry
grep -v darwin "$tmp/assets" > "$tmp/assets2"; rm -rf "$site/downloads"
echo '{"routes":[]}' > "$cfg"
bash "$here/download-redirects.sh" 9.9.9 "$tmp/assets2" "$site" >/dev/null
[ "$(jq -r '.downloads.darwin_arm64' "$site/downloads/latest.json")" = null ] || fail "missing asset should be null"
[ "$(jq '[.routes[]|select(.route=="/downloads/unitill-pos_darwin_arm64.tar.gz")]|length' "$cfg")" = 0 ] || fail "missing asset must get no route"

# ut-docs#1541 transition: a release from before the per-ABI APKs has only the
# universal android.apk — the per-ABI stable paths must still resolve (to the
# universal asset), never 404.
grep -v 'android-' "$tmp/assets" > "$tmp/assets3"; rm -rf "$site/downloads"
echo '{"routes":[]}' > "$cfg"
bash "$here/download-redirects.sh" 9.9.9 "$tmp/assets3" "$site" >/dev/null
for s in android-arm64 android-armv7; do
  r=$(jq -r --arg p "/downloads/unitill-pos_$s.apk" '.routes[]|select(.route==$p)|.redirect' "$cfg")
  [ "$r" = "$gh/unitill-pos_9.9.9_android.apk" ] || fail "$s must fall back to the universal apk, got '$r'"
done
[ "$(jq -r .downloads.android_arm64 "$site/downloads/latest.json")" = "$gh/unitill-pos_9.9.9_android.apk" ] || fail "manifest arm64 fallback"
# a release with no android asset at all: no android routes, nulls in the manifest
grep -v android "$tmp/assets" > "$tmp/assets4"; rm -rf "$site/downloads"
echo '{"routes":[]}' > "$cfg"
bash "$here/download-redirects.sh" 9.9.9 "$tmp/assets4" "$site" >/dev/null
[ "$(jq '[.routes[]|select(.route|test("android"))]|length' "$cfg")" = 0 ] || fail "no android asset -> no android routes"
[ "$(jq -r .downloads.android_armv7 "$site/downloads/latest.json")" = null ] || fail "no android asset -> null armv7"
echo "download-redirects: all tests passed"
