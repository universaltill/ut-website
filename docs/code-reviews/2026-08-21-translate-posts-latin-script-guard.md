# 2026-08-21 — translate-posts.js: generalize the untranslated-title guard to every Latin-script locale

**Card:** universaltill/ut-docs#871 (`complexity:easy`)
**Repo / branch:** `ut-website` / `feat/871-translate-posts-latin-script-guard`

## What shipped

`scripts/translate-posts.js`'s `verify()` function checks translated blog
output for a few defect classes. For non-Latin-script targets (`zh-cn`,
`fa-ir`) a `SCRIPT` regex map catches the model handing back untranslated
English. For Latin-script targets there's no script check possible —
instead a second heuristic (identical-title check) existed, but it was
hardcoded to fire only for `locale === "tr-tr"`. When `de-de` was added in
#756, it inherited **zero** protection against the model returning the
English title verbatim: heading count matches (same doc), link targets
match (same doc), "Universal Till" is still present, no `SCRIPT` entry to
fail, and the identical-title check never fired because `locale !==
"tr-tr"`.

- Generalized the check: any locale with **no** `SCRIPT` entry now gets
  the identical-title fallback (previously only `tr-tr`) — `de-de` and
  any future Latin-script locale addition are covered automatically.
- Wrapped the script's top-level CLI loop in `async function main()`,
  gated behind `if (import.meta.url === \`file://${process.argv[1]}\`)`,
  and added `export { verify };` — purely to make the pure `verify()`
  function unit-testable without hitting the LAN-only Ollama endpoint or
  touching real blog content. Confirmed behavior-neutral: the moved body
  is whitespace-only diffed against the original (no logic changed), and
  the CLI still runs unchanged end-to-end when invoked directly.
- Added `scripts/translate-posts_test.mjs` (Node's built-in `node:test`,
  no new dependency) with 6 cases covering: the `de-de` bug fix itself, a
  genuinely-translated `de-de` title passing clean, `tr-tr`'s pre-existing
  protection still working, `zh-cn`/`fa-ir` script-based checks unaffected
  and not double-firing the identical-title branch, and the pre-existing
  heading/link checks still working regardless of locale.
- Added a `check-translate-posts` CI job in `.github/workflows/ci.yml`
  running the new test (the script itself still can't run in
  GitHub-hosted CI — LAN-only — but its pure safety-net logic now has
  real coverage).

## TDD

Test-first: wrote the 6 cases before touching `verify()`, ran them
against the unfixed code — the `de-de` case failed with
`expected an "identical to the English" problem, got: []`, exactly the
gap described in the ticket. Applied the fix, re-ran — 6/6 green.

## Independent review (fresh-context Sonnet subagent, worktree-isolated, `complexity:easy` routing)

Read the diff cold. Ran `node --check`, the full test file, `npm ci &&
npm run build` (20 pages, clean), and the unrelated `check-i18n-keys.js`/
`check-swa-config.js` guards — all pass.

**Independently re-verified the TDD claim** (not taken on trust): reverted
just the `verify()` logic change inside its own isolated worktree, re-ran
the test file, reproduced the exact same `de-de` failure message
independently, then restored the fix and confirmed a byte-identical
restore (`git diff` against the pre-revert content came back empty) and
6/6 green again.

Verified the `main()` refactor is a pure mechanical move
(`git diff -w` on the moved body is empty — whitespace-only), and that the
direct-invocation guard correctly distinguishes CLI use (`node
scripts/translate-posts.js --locale de-de` still attempts real work —
`fetch failed` against the unreachable LAN endpoint, not a silent no-op)
from import (`import(...)` triggers no `main()` side effects, `verify` is
importable cleanly).

**Findings:**

1. **NIT** — the `import.meta.url === \`file://${process.argv[1]}\`` guard
   is POSIX-path-only (no URL-encoding, wrong separator on Windows). Not a
   live risk: this tool's whole purpose is talking to Ollama on a LAN NAS,
   Linux-only by construction. Not fixed — noted as accepted.
2. **OUT-OF-SCOPE-FOLLOWUP (informational, no action taken)** — the
   `main()`/export refactor is broader than the ticket's literal ask
   (generalize one check). Judged justified, not creep: it's the only way
   to unit-test the safety-net logic without hitting the LAN endpoint or
   touching real content, and it's verified behavior-neutral.
3. Test quality: each of the 6 cases checked to actually fail if the
   corresponding behavior broke — not tautological. Confirmed directly
   for the `de-de` case via the TDD revert; the `fa-ir` "only one
   problem, not a duplicate" assertion is a real check of the
   `if/else if` branch exclusivity, not a redundant assertion.
4. No secrets/tokens/credentials in the diff. No real client/shop name
   anywhere — all test fixtures are generic strings plus the product's
   own name ("Universal Till"), which `verify()` itself requires to be
   present.

## Verdict

**Safe to merge.** No blockers. One accepted NIT (Windows path-guard
portability, irrelevant to this Linux-only LAN tool). One review round —
nothing blocker-class was found, so no second round was earned.
