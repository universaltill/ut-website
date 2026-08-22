# Code review: README fix — translate-posts.js targets Ollama on the NAS, not LM Studio

- **Card:** universaltill/ut-docs#872
- **Branch:** `feat/872-readme-ollama-nas-not-lmstudio`
- **Complexity:** easy
- **Reviewer:** independent fresh-context Sonnet subagent (per `complexity:easy` routing)

## Change

`README.md`'s "Posts are translated, not just the chrome" section described
`scripts/translate-posts.js` as using "LM Studio, LAN-only" on the homelab.
The script's own header comment says the actual target has moved to
**Ollama on the NAS** (192.168.1.231, `nas/ollama/` in homelab-k8s) — LM
Studio was the old target, on a laptop that isn't always on. This staleness
was pre-existing (not introduced by ut-docs#756) and was noted in passing
during that card's own review, then filed separately as ut-docs#872.

One-line fix: `README.md`'s prose now says "Ollama on the NAS" instead of
"LM Studio", matching the script's header comment. Pure documentation
change — no code touched.

## Verification

- Confirmed `scripts/translate-posts.js`'s header comment (lines 8-11)
  states the real target as Ollama on the NAS, not LM Studio.
- Grepped the repo for other "LM Studio" references: the only remaining
  hits are `scripts/translate-posts.js` itself (correctly describing what
  it *used to* target, for context) and the historical
  `docs/code-reviews/2026-08-21-translate-posts-de-de-locale.md` record
  (a dated log entry, correctly left as-is). No other stale reference in
  the README.
- No CI check touches README prose content (`check-i18n`, `check-brand-
  assets`, `check-compliance-claims`, `check-documented-paths`,
  `check-swa-config`, `build`, `playwright` — none parse or assert on
  README.md), so this change carries no CI regression risk. Confirmed by
  reading `.github/workflows/ci.yml`.

## Independent review

Fresh-context subagent reviewed `git diff main` against the card's
acceptance scope. Verdict: **APPROVE**, no findings — correct wording
match to the script's header comment, no scope creep (one file, one
line), no other stale reference left behind, no grammar issue introduced.

## Outcome

Merged via PR, closing ut-docs#872.
