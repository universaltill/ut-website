# 2026-08-21 — translate-posts.js: add de-de locale

**Card:** universaltill/ut-docs#756 (`complexity:easy`)
**Repo / branch:** `ut-website` / `feat/756-translate-posts-de-de-locale`

## What shipped

`scripts/translate-posts.js`'s `LOCALES` map had no `de-de` entry, even
though German was already live in the site's marketing chrome (routes,
nav, `site/i18n.js`) via #604 (ut-website#20) — that card explicitly left
blog-post translation out of scope. This closes that gap:

- Added `"de-de": { language: "German (Deutsch)", audience: "shop owners
  in Germany" }` to `LOCALES`, mirroring the existing `tr-tr`/`zh-cn`/
  `fa-ir` shape exactly.
- Updated `README.md`'s description of which locales
  `node scripts/translate-posts.js` fills in.
- No `SCRIPT`-map entry added — German is Latin-script, same precedent as
  `tr-tr` (which also has no `SCRIPT` entry); see review finding below
  for a related but separate gap.
- Non-goal (per the ticket): does not run the script against existing
  posts. That stays a follow-up, same as it is for the other three
  locales today.

## Independent review (fresh-context Sonnet subagent, per `complexity:easy` routing)

Read the diff cold, re-derived the `verify()` heuristic from the source
rather than trusting the commit message, and ran the checks itself
(worktree-isolated, no shared-checkout risk since this diff has no
revert/restore TDD claim to re-verify).

**Findings:**

1. **Diff scope** — exactly matches the ticket: one `LOCALES` entry, one
   README sentence. No scope creep, no test changes, no post-generation
   run. Confirmed genuinely `complexity:easy`, not mislabeled.
2. **The SCRIPT-map judgement call** — the narrow claim ("German needs no
   `SCRIPT` entry, same as `tr-tr`") is correct: `verify()`'s `SCRIPT` map
   only exists to catch output that came back in the *wrong script*
   (`zh-cn`→Han, `fa-ir`→Arabic), which is meaningless for a same-script
   target. **But non-blocking gap surfaced**: `tr-tr` isn't actually
   "no special handling" — `verify()` (`scripts/translate-posts.js:239`)
   has a second heuristic hardcoded to the literal string `"tr-tr"` that
   catches the model handing back the English title unchanged. That
   check is not generalized to "any Latin-script locale lacking a
   `SCRIPT` entry," so `de-de` gets no protection against an untranslated
   post silently passing `verify()` once someone actually runs the
   script. Out of this card's scope (execution against real posts is a
   stated non-goal) — **filed as follow-up universaltill/ut-docs#871**.
3. **README accuracy** — the diff's edit is accurate and complete for
   what changed; grepped the rest of the repo (`BaseLayout.astro`,
   `site/i18n.js`, `tests/{seo,site-consistency}.spec.js`) and all
   already carry `de-de` from #604 — nothing else needed touching as a
   consequence of this change. Unrelated pre-existing staleness noted in
   passing: README still says the model is "LM Studio" on the homelab;
   the script's own header comment says the real target is now Ollama on
   the NAS (192.168.1.231) — **filed as follow-up
   universaltill/ut-docs#872**, not fixed here (out of scope for this
   ticket).
4. **Build** — `npm ci && npm run build`: clean, 20 pages, `de-de` pages
   generated identically to before (the script isn't part of the build).
5. **Tests** — `tests/site-consistency.spec.js`, all 23 pass, including
   the `de-de`-specific cases already present from #604. No test in
   `tests/` references `translate-posts.js` or asserts which locales it
   supports (expected — the script is LAN-only, can't run in
   GitHub-hosted CI, per its own header comment).
6. **Syntax** — `node --check scripts/translate-posts.js` clean.
7. **Secrets / client names** — none in the diff.

No TDD revert/restore verification applicable — this is not a bug fix
with a regression test, it's an additive config-shape change with no
new test to independently re-verify.

## Verdict

**Safe to merge.** No blocking findings. One review round — the findings
above are both non-blocking and explicitly out of this card's scope, so
no second round was earned (per the pipeline's model-routing/process-depth
rules).

## Merge

Merged via `merge_method: "merge"` (regular merge commit, per this
pipeline's standing commit-attribution policy).
