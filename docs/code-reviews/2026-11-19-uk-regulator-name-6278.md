# Review — UK regulator renamed to "Information Commission" on the legal pages (ut-docs#6278)

Uncommitted on `fix/6278-uk-regulator-name` (ut-website). Companion records: universal-till and ut-docs `code-reviews/2026-11-19-uk-regulator-name-6278.md`. Author model Sonnet 5.5; reviewer Opus 5.5 (independent subagent, fresh context); tester Sonnet 5.5. Card notes: `C:\unitill\notes-6278\01-05`.
Pre-flight: review record — this file · ADR n/a · legal record → ut-docs `legal-reviews/2026-11-19-uk-regulator-name-6278.md` · all locales: single en-gb legal source (src/content/legal/en-gb) · site/ HTML and src grep: no old name left (F7).

## What shipped (ut-website)
`privacy.mdx:17` and `app-privacy.mdx:17`: "registered with the Information Commission (formerly the Information Commissioner's Office), registration number ZC263752"; `impressum.mdx:25`: "UK Information Commission, formerly the Information Commissioner's Office". New `tests/legal-regulator-name.spec.js`: source-level check over every legal page; the old name is allowed only inside the exact "formerly the Information Commissioner's Office" bridge (to be dropped on/after 2027-09-30).

## Findings
| # | Sev | Finding | Outcome |
|---|---|---|---|
| F1 | Low | universal-till Go guard: "formerly" anywhere in a string exempts it (proven false pass) | Fixed 2026-11-19: only the exact bridge phrase is stripped (both apostrophes, any case), then any remaining old name fails; table test incl. the "formerly called Data" probe (red first, then green) |
| F2 | Low | ut-website spec: case-sensitive, misses "the Commissioner's Office" (probe: 0 hits) | Fixed 2026-11-19: case-insensitive, also catches "Commissioner's Office", exact-bridge strip; matcher test added; 6 mdx files still pass |
| F3 | Medium | No committed legal-reviews record for live legal text + approved notice change | Fixed 2026-11-19: `legal-reviews/2026-11-19-uk-regulator-name-6278.md` written; pointer added to the 6559 record |
| F4 | Low | partner draft :7 asserts "decision on #6278"; mahshid76 must record it on the card | Fixed 2026-11-19: reworded to "wording proposed on #6278, not yet recorded by the partner-section owner"; mahshid76 still to record on card |
| F5 | Low | notice_text_test.go:9-13 comment contradicts no-bump | Fixed 2026-11-19: comment now says material change bumps, non-material correction in a legal record keeps it (#6278) |
| F6-F8 | Info | long line privacy.mdx:17; guard coverage limited to en.json / src/content/legal (grep clean); bridge drop date not enforced → card | F6, F7 accepted; F8 accepted, card for the 2027-09-30 bridge drop still to be filed |

NoticeVersion: **not bumped** (owner mahshid76 decided 2026-11-19). `auto.go:60-63` bumps on a material change of what is sent; `auto.go:122` stops check-ins on every till until re-shown. The change renames the same complaint body only (s.119(2) already reads old references as the Commission). Record the correction in the legal record.

## Verification
Website spec with the repo's own Playwright (temporary config without the web server, deleted): 8/8 pass (matcher test, "pages exist" check, 6 mdx files). Fail-first on the old text: reviewer ran the original matching logic over HEAD copies, 1 hit each. Not run: `npm run build`, legal-pages.spec.js (CI), a rendered look at the pages.

Open gates: owner OK on #6278 for the live notice text and no-bump; human browser check of ico.org.uk (agents get 403).
Verdict: APPROVE after F1-F5 (fixed 2026-11-19, see Outcome; re-verified by the Dev, not re-reviewed).
