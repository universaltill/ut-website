#!/usr/bin/env bash
# Runtime smoke test for the two ut-cms images (Phase 2 design card C4,
# ut-docs#4998): start them the way the homelab pod and the Container Apps
# replica do — two containers sharing one network namespace, read-only root
# filesystem, writable /tmp only, every capability dropped, the image's own
# non-root user — and check behaviour, not config:
#
#   * nginx answers /healthz, /version and the admin page on 127.0.0.1:8080,
#     with its security headers, and 404s an unknown path (no SPA fallback);
#   * the relay answers /healthz on 127.0.0.1:8081, and nginx proxies
#     /api/auth to it — which reads the GitHub client id from a FILE under
#     SECRETS_DIR at request time and hard-codes scope=public_repo;
#   * neither process answers on the container's own (non-loopback) address;
#   * neither image runs as root.
#
# The "secrets" mounted here are throwaway placeholders written to a fresh
# temp dir; no real credential is used or needed.
#
# Usage: WEB_IMAGE=<ref> RELAY_IMAGE=<ref> bash cms/scripts/smoke.sh
set -euo pipefail

: "${WEB_IMAGE:?set WEB_IMAGE}"
: "${RELAY_IMAGE:?set RELAY_IMAGE}"

suffix="$$-${RANDOM}"
web="ut-cms-smoke-web-${suffix}"
relay="ut-cms-smoke-relay-${suffix}"
secrets="$(mktemp -d)"

cleanup() {
  docker rm -f "$web" "$relay" >/dev/null 2>&1 || true
  rm -f "$secrets/website-cms-github-client-id" "$secrets/website-cms-github-client-secret"
  rmdir "$secrets" 2>/dev/null || true
}
trap cleanup EXIT

printf 'smoke-client-id\n' > "$secrets/website-cms-github-client-id"
printf 'smoke-client-secret\n' > "$secrets/website-cms-github-client-secret"
chmod 0755 "$secrets"
chmod 0644 "$secrets"/*

fail=0
check() { # check <description> <command...>
  local what="$1"; shift
  if "$@"; then echo "PASS  $what"; else echo "FAIL  $what"; fail=1; fi
}

for img in "$WEB_IMAGE" "$RELAY_IMAGE"; do
  # A digest ref straight from the registry is not in the local store yet.
  docker image inspect "$img" >/dev/null 2>&1 || docker pull -q "$img" >/dev/null
  user="$(docker image inspect --format '{{.Config.User}}' "$img")"
  check "$img runs as non-root user '$user'" \
    test -n "$user" -a "$user" != "0" -a "$user" != "root"
done

hardening=(--read-only --tmpfs '/tmp:rw,size=16m' --cap-drop ALL --security-opt no-new-privileges)

# The relay owns the shared network namespace (like the pod's pause
# container); nginx joins it, so 127.0.0.1 is the same loopback for both.
docker run -d --name "$relay" "${hardening[@]}" \
  -v "$secrets:/mnt/secrets-store:ro" "$RELAY_IMAGE" >/dev/null
docker run -d --name "$web" "${hardening[@]}" \
  --network "container:$relay" "$WEB_IMAGE" >/dev/null

# fetch <url> -> prints "<status>\n<headers as JSON>\n<body>"; runs inside the
# relay container (node is there, curl is not) so it sees the shared loopback.
fetch() {
  docker exec "$relay" node -e '
    fetch(process.argv[1], { redirect: "manual" }).then(async (r) => {
      console.log(r.status);
      console.log(JSON.stringify(Object.fromEntries(r.headers)));
      process.stdout.write(await r.text());
    }).catch((e) => { console.log("ERR " + (e.cause && e.cause.code || e.message)); });
  ' "$1"
}

# Wait for both listeners (a few seconds at most).
for _ in $(seq 1 30); do
  if [ "$(fetch http://127.0.0.1:8080/healthz | head -1)" = 200 ] &&
     [ "$(fetch http://127.0.0.1:8081/healthz | head -1)" = 200 ]; then
    break
  fi
  sleep 1
done

out="$(fetch http://127.0.0.1:8080/healthz)"
check "web /healthz -> 200 ok" test "$(head -1 <<<"$out")" = 200 -a "$(sed -n '3,$p' <<<"$out")" = ok
check "web /healthz keeps the security headers" grep -q '"x-frame-options":"DENY"' <<<"$out"

out="$(fetch http://127.0.0.1:8080/version)"
check "web /version -> 200 ut-cms + pinned decap" grep -q '{"app":"ut-cms","decap":"[0-9.]*"}' <<<"$out"

out="$(fetch http://127.0.0.1:8080/)"
check "web / -> 200 admin page" test "$(head -1 <<<"$out")" = 200
check "web / is the Decap page" grep -q 'unpkg.com/decap-cms@' <<<"$out"
check "web / sends nosniff" grep -q '"x-content-type-options":"nosniff"' <<<"$out"

out="$(fetch http://127.0.0.1:8080/no-such-page)"
check "web unknown path -> 404 (no SPA fallback)" test "$(head -1 <<<"$out")" = 404

out="$(fetch http://127.0.0.1:8081/healthz)"
check "relay /healthz -> 200" test "$(head -1 <<<"$out")" = 200

out="$(fetch 'http://127.0.0.1:8080/api/auth?provider=github&scope=repo')"
check "nginx proxies /api/auth to the relay -> 200" test "$(head -1 <<<"$out")" = 200
check "relay read the client id from the mounted FILE" grep -q 'client_id=smoke-client-id&' <<<"$out"
check "relay pins scope=public_repo" grep -q 'scope=public_repo' <<<"$out"
not_in() { ! grep -q "$1" <<<"$2"; }
check "relay never sends the client secret" not_in smoke-client-secret "$out"
check "relay posts to the CMS origin" grep -q '"https://cms.universaltill.com"' <<<"$out"

# Loopback only: the container's own address must refuse both ports.
ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$relay")"
if [ -n "$ip" ]; then
  for port in 8080 8081; do
    out="$(fetch "http://${ip}:${port}/healthz")"
    check "nothing answers on ${ip}:${port} (loopback bind)" grep -q '^ERR ECONNREFUSED' <<<"$out"
  done
else
  echo "FAIL  could not read the container address"; fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "--- web logs";   docker logs "$web" 2>&1 | tail -20
  echo "--- relay logs"; docker logs "$relay" 2>&1 | tail -20
  exit 1
fi
echo "OK: both ut-cms images start hardened and serve their routes"
