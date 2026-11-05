# Legal name spelling: Farsid Mirza (impressum)

**Change:** the Impressum named the authorised representative "Farshid Mirza". The
legal name is "Farsid Mirza" (owner, 2026-11-05). Corrected in
`src/content/legal/en-gb/impressum.mdx` and the two assertions in
`tests/legal-pages.spec.js`.

**Findings:** none. Text-only; no other locale or page names the representative
(grep for "Mirza" across `src/` and `site/` returns the one line).

**Verified:** grep shows no remaining "Farshid" in the repo's content or tests.
The Playwright legal-pages assertions now expect the corrected name.

**Verdict:** safe to merge. Legal-text change, so owner sign-off is the owner's own
instruction. Deferred: the same misspelling in other repos (review records, code
comments, test fixtures) is tracked on a separate card.
