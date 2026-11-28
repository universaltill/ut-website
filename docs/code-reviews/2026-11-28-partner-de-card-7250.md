# Review: German partner card `#partner-de` on /contact (ut-docs#7250), ut-website

Date 2026-11-28. Part of ut-docs#7250 (stays open: the PR is draft until the publication gate below is met).
Reviewer: Fable 5.2, independent of Dev and Tester, on the uncommitted working tree of `feat/7250-partner-de` vs origin/main. Inputs: BA, UX, Dev, Tester notes and the legal review record (lane temp folder `temp/website-partner-de/`). No product code edited by the reviewer.

## What shipped
One new card on `/<locale>/contact`, after `#partners`, before `#security`: heading, postal block in `<address>` (literal HTML, `dir="ltr"`), country line, `USt-IdNr.:` label (literal, `lang="de" dir="ltr"`) with the number in `<bdi dir="ltr">`, and one independence line. Three keys (`contact.partnerde.t`, `.country`, `.indep`) in `en.json` + `en.meta.json` (all `review: "standard"`), German values in `de-de.json`, `site/i18n-data.js` regenerated, three CSS rules (`address` not italic, spacing, `scroll-margin-top: 8rem`), new `tests/partner-de.spec.js`. No phone, email, link, image, script or placeholder.

## Findings
| # | Sev | Finding | Outcome |
|---|---|---|---|
| R1 | important (gate, not a code defect) | Publication preconditions from the legal review are open: (a) the partner's written confirmation of the exact entry is not on file; (b) the VAT ID is rendered, while legal M1/Q2 says show it only on the partner's explicit yes (owner order on the card lists it, so it stays in the draft); (c) the privacy-policy paragraph (legal M2/Q3, "add in the same PR", owner OK needed) is not in the diff. | Not fixed here. PR stays DRAFT. Before merge: attach the reply to #7250, delete the VAT `<p>` and its two spec assertions if he does not say yes, add the privacy paragraph or record the owner's decision not to. |
| R2 | medium | The `scroll-margin-top` fix (Tester defect 1) has no test. Mutation run with the rule deleted: all overflow/RTL tests still pass. | Open, for Dev: assert the landing (`/de-de/contact#partner-de` at 390px, card top >= header bottom) or at least the computed `scrollMarginTop`. Behaviour itself verified by hand (below). |
| R3 | medium (decision) | `contact.partnerde.indep` is a legal disclaimer (it is the mitigation for legal H2) but is `review: "standard"`. The guard's regex does not fire, so nothing fails, yet README says anything that looks legal is `legal`. As `standard`, unreviewed Weblate translations of "cannot make contracts or commitments in our name" will publish in ten locales. As `legal`, German readers would see the English line until a human approves. | Accepted for the draft; owner/orchestrator to choose before merge. Reviewer's lean: keep `standard` (English is operative, German text is the counsel-drafted one) and say so in the meta description, or switch to `legal` if the owner prefers certainty over German. |
| R4 | low | German values are hand-added to `de-de.json`, against the usual "English + meta only, Weblate translates" rule (ADR-0160). They survive `sync-locales` only while de-de is `machine_label` and not `human_reviewed` (`scripts/sync-locales.mjs`, `keepSeed`); after that flip, without the strings in Weblate, the card falls back to English and the `de-de` spec test fails on the sync PR. | Accepted (the card is aimed at German readers and the text is counsel-drafted). Follow-up: enter the same three strings in Weblate. |
| R5 | low | Weak assertions: `toContain("Germany")` / `"Deutschland"` are already satisfied by the heading, so the country line is not tested; "exactly once" (AC1), the forbidden-word list (AC4) and phone/email-like text (AC3) are not asserted. | Open, for Dev: assert on the token list (`t` includes the exact token `Germany` / `Deutschland`), count 1, and a denylist regex on the card text. |
| R6 | note | Dev captured no red run. | Covered by the reviewer's mutation run. |
| R7 | nit | README's Contact paragraph does not mention the card or `tests/partner-de.spec.js`. No rule requires it; its existing sentences stay true (mailto set unchanged, no form). | Optional one sentence. |

## Verification (by the reviewer)
- Data exact, byte-checked: `HAAFT-IT`, `Nima Haghighi`, `Eisvogelweg 15`, `54296 Trier`, `Deutschland` (de) / `Germany` (en), `USt-IdNr.:` `DE370378150`. The card in `site/contact.html` is pure ASCII (no look-alike hyphen, no NBSP). No phone, email, service, price, certification, fiscal or availability claim in en or de; "partner" appears only in the heading. German reads naturally and equals the legal record's wording.
- `node scripts/gen-locales.mjs`: output byte-identical to the committed-to-be `site/i18n-data.js`, `git status` unchanged; `--check` up to date. `guard-i18n-meta` OK (558 keys), `check-i18n-keys` OK (327 keys), compliance-claims guard OK.
- Fresh build + Playwright: `partner-de`, `contact-page`, `csp` specs 189 passed; after restore `partner-de` + `contact-page` 55 passed. CSP spec zero violations; the card adds no external asset, no inline script.
- Mutation run (VAT `…105`, postcode `54269`, scroll-margin rule deleted; restored and compared byte for byte): 13 failed on the exact values "54296 Trier" and "DE370378150" in all 12 locales, 10 passed, none noticed the missing scroll margin (R2).
- Anchor landing driven in Chromium, 320/390/768 px, en-gb/de-de/ar-sa: card top 128 px, sticky header bottom 121 px (7 px clear); desktop header 72 px. RTL: VAT line reads `USt-IdNr.: DE370378150` in ar-sa and fa-ir.
- Not verified: real devices, screen reader, VIES validity of the VAT ID, that the data matches the partner's image (reviewer saw only the transcription).

Pre-flight: price n/a; capability claim n/a (none made, checked en + de); till behaviour n/a; new en.json keys: `en.meta.json` updated; help topic n/a (public marketing page); ADR n/a; plugin n/a; privacy policy: deferred, see R1(c) on #7250; review record: this file.

## Verdict
Code approved for a DRAFT PR. Not approved to publish until R1 is closed on #7250; R2 and R5 should be fixed in the same branch before merge; R3 needs a decision.

## Follow-up fixes (orchestrator, same branch)
- R2 fixed: `tests/partner-de.spec.js` "anchor lands below the sticky header"; verified red with the `scroll-margin-top` rule deleted, green restored.
- R5 fixed: country line, exactly-once data, no phone/email-like text and no claim words are now asserted.
- R3 decision (keep `standard`, owner informed) and R4 (add the three strings to Weblate) stay on #7250; R1 is the publish gate: PR stays DRAFT.
