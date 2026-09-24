# 2026-09-24 — ut-plugin-faq default branch renamed to `main` (ut-docs#2643)

**Change.** `universaltill/ut-plugin-faq` had its default branch named `001-multilingual-faq-page` (a spec-kit feature name) and a stale, disjoint `main` (2026-07-07, one unique commit `2885328`: an early CLAUDE.md that the default branch later replaced). The stale `main` was deleted and the default renamed to `main` via GitHub's branch-rename API. The five merged feature branches (PRs #2–#6) were deleted after an `is-ancestor` re-check. Follow-ups:
- `ut-plugin-faq`: `auto-tag-release.yml` restored to the canonical copy from `ut-plugin-tax-de` (the #1797 per-repo exception is gone); the `ci.yml` push trigger is `[main]` only.
- `ut-website`: the build-time manifest fetch for `ut-plugin-faq` uses `main`.

**Review.** Independent review by a different-model subagent (Sonnet), read-only. No findings:
- Nothing else references the old branch name. The only remaining mentions are the `specs/001-*` directory names and frozen history.
- There are no rulesets or branch protection.
- `auto-tag-release.yml` is byte-identical to the canonical copy.
- Merging won't create a tag: manifest `0.2.3` already has `v0.2.3`, so the workflow prints "Nothing to do".

**Verified.** `default_branch` = `main`; the remote has only `main`; raw `main/manifest.json` returns 200; `npm run build` for ut-website lists the FAQ plugin on `/en-gb/plugins/`.

**Exposure.** None new. The public repo loses only a stale branch; history is unchanged, and the old SHA is recorded on ut-docs#2643.
