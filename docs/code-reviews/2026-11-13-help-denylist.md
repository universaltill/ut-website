# Review: help deny list beats public:true

Date: 2026-11-13 · Branch: `fix/help-denylist`

## Why
The site builds help from the till's latest release tag (v0.36.0), where
`claim.md` is still `public: true`; that flag overrode the allow-list's
"NOT public" comments, so `/en-gb/help/claim/` was published and
`tests/help-pages.spec.js:163` failed on every PR (also on main).

## Change
- `data/help-public-denylist.txt`: the six owner-excluded ids (claim,
  support-partner, translate-mode, translations, fiscal-device,
  fiscal-register), cross-checked against the allow-list's NOT-public block,
  the spec's list and universal-till#2498.
- `src/lib/help.ts`: `isPublic(..., deny)`; deny wins over `public: true`,
  `public: false` and the allow-list. Missing file = empty list (fail-open
  to the previous behaviour, like the allow-list).
- Tests first: two new cases in `src/lib/help_test.mjs` (precedence; and
  `buildHelp` drops a denied `public: true` topic), seen failing before the fix.

## Notes
- Links from public topics to a denied topic already render as plain text
  (`isPublic` closure uses `publicSlugs`).
- The deny list can be deleted once a till release carries `public: false`
  for these topics, but is harmless to keep.
- Full astro build + playwright run in CI (needs network for the help source).
