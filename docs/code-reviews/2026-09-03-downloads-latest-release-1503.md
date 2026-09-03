# Review: keep `/downloads` in step with the newest product release (ut-docs#1503)

**PR:** [universaltill/ut-website#31](https://github.com/universaltill/ut-website/pull/31) (merged 2026-09-03T10:43:23Z)
**Reviewer:** scrum-master pipeline (`lane:cloud-54`), retroactive — the PR merged
before this cycle picked the card up, with no review record committed at
merge time. This fills that gap and records the live verification performed
below, per this repo's own "every substantive change lands with a review
record" rule.

## What shipped

`.github/workflows/deploy.yml` gained an hourly `schedule` trigger
(`17 * * * *`) plus a `check` job that compares the site's staged
`/downloads/latest.json` version against `universal-till`'s newest GitHub
release, and only runs the existing `deploy` job when the site is actually
behind. Every other trigger (push to `main`, `workflow_dispatch`) still
deploys unconditionally, unchanged from before. An unreadable release list
fails the check (`exit 1`) rather than reading as "up to date", so a
transient API failure can't be mistaken for "nothing to do" and let the site
rot silently the way the original bug did.

## Why this was p1

`v0.9.1` — the version frozen on the site before this fix — predates the
ADR-0074 schema reset (78 migrations vs. the squashed `001_init.sql`
baseline). A shop installing from the website got a pre-reset database that
the next update refuses to open (`database predates the schema reset —
delete the data directory and start again`, by design, no migration path).
The website was the shortest route to a dead till with the operator's data
in it.

## Verification performed this cycle

Diff review (single file, 47 lines added, no deletions):

- The `check` job's short-circuit for non-`schedule` events preserves prior
  behaviour exactly (`push`/`workflow_dispatch` always deploy).
- The staleness comparison is a plain string equality on `version` from
  `latest.json` vs. the release tag with its `v` prefix stripped — correct
  for this repo's tagging scheme (`v0.10.1` → `0.10.1`).
- Fail-closed on an empty `$LATEST` is correct and matches the stated intent.
- No behaviour change to asset selection/mirroring (Android APK exclusion,
  stable-name rewriting) — untouched by this diff.

Live evidence (not just CI-green-in-isolation):

- `universaltill/universal-till`'s newest release is **v0.10.1**, published
  2026-09-03T12:40:43Z.
- `ut-website` deploy run [33756637478](https://github.com/universaltill/ut-website/actions/runs/33756637478)
  started 2026-09-03T12:41:19Z — 36s after that release published — and its
  "Stage release installers + write latest.json manifest" step completed
  successfully at 12:42:01Z, which stages whatever `gh release view` resolves
  to at that moment (v0.10.1). The `deploy` job then completed successfully
  (Azure Static Web Apps upload succeeded).
- Two further deploys succeeded after the PR merged (10:43:26 push-triggered,
  11:22:51 dispatch), all `conclusion: success`, none reverting the fix.

**One caveat, not a blocker:** as of this verification the `schedule`
trigger itself had not yet been observed firing on its own cron tick (both
post-merge redeploys that exercised the staging step were
`workflow_dispatch`, not `schedule`) — GitHub can delay a newly-added
schedule's first tick. The mechanism is proven correct by code review and by
every manually-triggered run exercising the same staging/deploy steps the
scheduled run would use; the `check` job's stale/current branch logic itself
is simple enough (one string comparison) that this is a low-risk gap, not a
reason to hold the card open. Worth a glance next time someone's in this
repo, to confirm a `schedule`-triggered run has since appeared.

## Verdict

**Approved, already live.** No further changes needed. Closing
ut-docs#1503.
