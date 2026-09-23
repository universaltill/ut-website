#!/usr/bin/env bash
# Tests for scripts/stage-downloads.sh (ut-docs#2486): installers are mirrored
# by priority within a byte budget; the rest become 302 routes to GitHub.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*"; exit 1; }

rel="$tmp/rel"; site="$tmp/site"; mkdir -p "$rel" "$site"
echo '{"routes":[{"route":"/en-gb","rewrite":"/index.html"}]}' > "$site/staticwebapp.config.json"
mk() { head -c "$2" /dev/zero > "$rel/unitill-pos_9.9.9_$1"; }
mk windows_amd64.zip 50; mk darwin_arm64.tar.gz 40; mk linux_arm64.deb 30
mk linux_amd64.deb 30; mk linux_amd64.tar.gz 30; mk linux_arm64.tar.gz 30; mk android.apk 500

# budget 125 bytes: windows(50)+darwin(40)+pi deb(30)=120 fit; the rest don't
bash "$here/stage-downloads.sh" 9.9.9 "$rel" "$site" 125 >/dev/null

for f in windows_amd64.zip darwin_arm64.tar.gz linux_arm64.deb; do
  [ -f "$site/downloads/unitill-pos_$f" ] || fail "$f should be mirrored"
done
for f in linux_amd64.deb linux_amd64.tar.gz linux_arm64.tar.gz android.apk; do
  [ ! -e "$site/downloads/unitill-pos_$f" ] || fail "$f must not be mirrored"
done
gh="https://github.com/universaltill/universal-till/releases/download/v9.9.9"
r=$(jq -r '.routes[]|select(.route=="/downloads/unitill-pos_linux_amd64.deb")|"\(.redirect) \(.statusCode)"' "$site/staticwebapp.config.json")
[ "$r" = "$gh/unitill-pos_9.9.9_linux_amd64.deb 302" ] || fail "redirect route wrong: '$r'"
[ "$(jq -r '.routes[-1].route' "$site/staticwebapp.config.json")" = "/en-gb" ] || fail "existing routes must be kept"
[ "$(jq -r '.routes|map(select(.route=="/downloads/unitill-pos_windows_amd64.zip"))|length' "$site/staticwebapp.config.json")" = 0 ] || fail "mirrored file must not get a redirect"
m="$site/downloads/latest.json"
[ "$(jq -r .version "$m")" = 9.9.9 ] || fail "manifest version"
[ "$(jq -r .downloads.windows_amd64 "$m")" = /downloads/unitill-pos_windows_amd64.zip ] || fail "mirrored manifest url"
[ "$(jq -r .downloads.linux_amd64_tar "$m")" = "$gh/unitill-pos_9.9.9_linux_amd64.tar.gz" ] || fail "skipped manifest url"
[ "$(jq -r .downloads.android "$m")" = "$gh/unitill-pos_9.9.9_android.apk" ] || fail "android url"

# a missing asset is skipped without a route or a crash
rm "$rel/unitill-pos_9.9.9_darwin_arm64.tar.gz"; rm -rf "$site/downloads"
echo '{"routes":[]}' > "$site/staticwebapp.config.json"
bash "$here/stage-downloads.sh" 9.9.9 "$rel" "$site" 125 >/dev/null
[ "$(jq -r '.downloads.darwin_arm64' "$site/downloads/latest.json")" = null ] || fail "missing asset should be null in manifest"
echo "stage-downloads: all tests passed"
