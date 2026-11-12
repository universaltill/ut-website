# 2026-11-12 — cancel superseded PR runs (ut-docs#6145)

**What changed.** `ci` and `commit-attribution` gain a top-level `concurrency:` block:
`group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`,
`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`.


**Why.** Every push to a PR queued a full run on the shared homelab runners
while the superseded one kept going.

**Safety.** Only `pull_request`/`pull_request_target` events cancel; pushes and
`workflow_dispatch` never do (group key differs, workflow name is in the key).
No job or workflow `name:` changed, so required-check names are unchanged.
Untouched: cms-images (already has a group), deploy, sync-locales.

**Verified.** YAML/diff inspection; no guard added (repo has no guard runner). Cancel behaviour itself is only
observable on the PR's own second push. Review by the dev agent only
(config-only change), mirroring ut-cloud#992.
