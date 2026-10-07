#!/usr/bin/env bash
# Negative tests for check-swa-config.js's route guards (ut-docs#3809).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
fail() { echo "FAIL: $*"; exit 1; }
run() { printf '%s' "$1" > "$tmp/c.json"; node "$here/check-swa-config.js" "$tmp/c.json" >/dev/null 2>&1; }

run '{"routes":[{"route":"/downloads","redirect":"/a","statusCode":301}]}' || fail "a single route must pass"
! run '{"routes":[{"route":"/downloads","redirect":"/a","statusCode":301},{"route":"/downloads/","redirect":"/a","statusCode":301}]}' || fail "routes differing only by a trailing slash must fail (Azure refuses the deploy)"
run '{"routes":[{"route":"/x","methods":["GET"],"redirect":"/a"},{"route":"/x","methods":["POST"],"redirect":"/b"}]}' || fail "the same route with different methods is allowed by Azure"
run '{"routes":[{"route":"/"},{"route":"/blog/*"},{"route":"/blog"}]}' || fail "/ , /blog/* and /blog are distinct"
! run '{"routes":[],"responseOverrides":{"401":{"redirect":"/x"}}}' || fail "a 401 override must fail"
! run '{"routes":[],"responseOverrides":{"404":{"rewrite":"/404.html","statusCode":200}}}' || fail "a 404 override that changes the status must fail"
echo "check-swa-config_test: all tests passed"
