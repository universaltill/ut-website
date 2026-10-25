# Review: ut-cms config baked into GHCR images (Phase 2 card C4)

Date: 2026-10-25 · Branch: `feat/c4-cms-config-images` · Design: ut-docs#4998
(`reference/azure-phase2-container-apps.md` §3.4, card C4)

## What shipped

Azure Container Apps has no ConfigMaps, so the CMS at `cms.universaltill.com`
can no longer take its admin page, nginx config and OAuth relay from
homelab-k8s ConfigMaps. They now live in this repo and are baked into two
images:

- `cms/web/` → `ghcr.io/universaltill/ut-cms-web`: nginx-unprivileged
  1.30.5-alpine3.24-slim (tag + digest), uid 101, `index.html` +
  `default.conf` (ported unchanged apart from comments) + a new `nginx.conf`
  that keeps pid/temp paths in `/tmp`, `server_tokens off`.
- `cms/relay/` → `ghcr.io/universaltill/ut-cms-relay`: node 26.12.1-alpine3.24
  (tag + digest), uid 1000, `relay.js` only, npm/corepack/yarn removed from
  the running fs, non-secret config baked in as ENV (`SITE_ORIGIN`, `PORT`,
  `NODE_ENV`, `SECRETS_DIR`). The GitHub client id/secret stay files under
  `SECRETS_DIR` (Key Vault volume), read per request.
- `.github/workflows/cms-images.yml`: `test` (node suites + shellcheck),
  `smoke` (native build + runtime smoke on amd64 and arm64 GitHub-hosted
  runners), `publish` (main only: multi-arch buildx push tagged by commit
  sha, provenance + SBOM, smoke of the pushed digests, keyless cosign sign +
  verify, amd64+arm64 manifest check, digests to the run summary and an
  artifact). Top-level `contents: read`; only `publish` gets `packages: write`
  + `id-token: write`.
- Tests ported from homelab-k8s (`relay.test.js`, admin-page/hosts checks in
  `web.test.js`) now read the exact files the Dockerfiles copy; new
  `images.test.js` (digest pins, numeric non-root user, no secret-looking
  name in any ENV/ARG incl. continuation lines, entrypoint cleared, minimal
  COPY, `.dockerignore` = `*`). `cms/scripts/smoke.sh` runs both containers
  in one netns with `--read-only`, tmpfs `/tmp`, `--cap-drop ALL`,
  `no-new-privileges`, placeholder secret files, and checks health, version,
  page, 404 (no SPA fallback), security headers, `/api/auth` via nginx
  (client id read from the file, `scope=public_repo`, secret never sent) and
  that nothing answers on the container's non-loopback address.

## Review

Independent review by a Fable subagent (security focus). Verdict: no blocker,
no high.

| # | Sev | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | New GHCR packages start private; the deployer pulls anonymously; publish-job smoke pulls with its own token so it stays green | Documented in the workflow header + README as a one-time owner step (same as ut-admin-app). **Decision/action for the owner** |
| 2 | Low | Digest was signed before the published-bytes smoke | Fixed: smoke runs first, then sign |
| 3 | Low | arm64 published variant never executed (amd64 runner pulls amd64) | Accepted + documented: same inputs/base digest as the native-arm `smoke` job |
| 4 | Low | Relay loopback bind only checked at run time | Fixed: static `listen(PORT, '127.0.0.1'` assertion; mutation fails it |
| 5 | Low | `/healthz` "no secrets" test could not fail | Fixed: secrets-dir reads throw during the call; mutation (healthz reads the id file) fails it |
| 6 | Low | npm removal overstated as CVE reduction | Comment corrected (runtime fs only, lower layer keeps the files) |
| 7 | Nit | Design says nginx 1.27.5; image pins 1.30.5 | Note for C6 to update the design table |
| 8 | Nit | `persist-credentials` default in publish | Fixed: `false` |
| 9 | Nit | smoke checks image USER, not live uid | Accepted: no `--user` override, equivalent |
| 10 | Nit | redundant `event_name != pull_request` | Kept: documents intent |

Self-found during Tester: the first secret check only matched a line starting
`ENV`/`ARG`, so `ENV A=1 \` + `    GITHUB_CLIENT_SECRET=x` passed. Rewritten to
scan every `NAME=` and `ARG NAME`; the mutation now fails.

## Verified beyond automated tests

- Fidelity: `index.html` byte-identical to the ConfigMap; `default.conf` and
  `relay.js` differ only in comments (reviewer diffed ignoring comments).
- Mutations (static suite): USER 0, undigested FROM, ENV-continuation secret,
  `ARG NPM_TOKEN`, `COPY .`, `scope='repo'`, wrong `base_url`, Decap pin drift,
  0.0.0.0 listen, relay all-interface listen, healthz reading secrets — all
  fail the suite (reviewer ran 27 more; 23/25 applicable killed before fixes
  4/5, both survivors now killed).
- Runtime: smoke 17/17 locally (arm64 native); a build with nginx on
  `listen 8080` fails the smoke on loopback + healthz checks. amd64 buildx of
  both images succeeds. A `ghp_`/`BEGIN PRIVATE` sweep of the relay image hit only the
  node binary's embedded strings (expected); no secret files in either image.
- Existing CI unaffected: `check-swa-config.js`, brand/compliance/plan
  guards, i18n check pass; `cms/` is outside `src/`/`site/`, the SWA deploys
  `dist/` only, Playwright `testDir` is `./tests`. `cms/package.json`
  (`type: commonjs`) is needed because the site root is ESM.
- No visual surface changed (page bytes identical); nothing looked at.

## Safe to merge?

Yes. Merging publishes the first images from main.

## Deferred / follow-ups

- Owner: flip `ut-cms-web` and `ut-cms-relay` GHCR packages to public after
  the first publish.
- Until homelab-k8s switches its ut-cms Deployment to these images (or the
  homelab app is retired at the Phase 2 cut-over), its ConfigMaps are a
  second copy: change both. The homelab `validate.yml` job keeps testing that
  copy.
- C6 (ut-infra): pin the digests from this workflow's summary; carry the
  oauth2-proxy flag tests (host flags, host-only cookie, skip-auth routes)
  that stayed in homelab-k8s; update §3.4's nginx version.
