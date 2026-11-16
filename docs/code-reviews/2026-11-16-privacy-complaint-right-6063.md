# Privacy page: right to complain to the controller, retention criterion (card ut-docs#6063)

## What changed
`src/content/legal/en-gb/privacy.mdx` only, plus one Playwright assertion in `tests/legal-pages.spec.js`:

1. "Your rights" now states the right to complain to us, how (email), that we acknowledge within 30 days and
   report the outcome, and names the UK regulator as the Information Commission (formerly the Information
   Commissioner's Office). Source: UK GDPR Art. 13(2)(ca) and (d) and Data Protection Act 2018 s.164A, read on
   legislation.gov.uk on 2026-11-16 (Art. 13(2)(ca) inserted 19 June 2026 by the Data (Use and Access) Act
   2025, S.I. 2026/82 reg 3(b); "the Commission" in the 30 September 2026 version).
2. Billing section, last line: "how to complain to the ICO" now reads "to us or to the regulator".
3. `updated:` 2026-11-16.

Not changed on purpose: the two "registered with the Information Commissioner's Office, registration number"
lines (privacy "Who we are", legal notice). They state the register entry as it was issued.

## Review
Legal text: found and drafted by Fable 5.2 in the legal role during the sign-off review of the live-payments
pack; record `ut-docs/legal-reviews/2026-11-16-fable-signoff-6063-5422-3264.md`. AI review, not legal advice.
An independent second-model read (Sonnet) of this diff was run before the commit. Applied from it: the
complaint wording no longer asks for set words (DPA 2018 s.164A(2), facilitate), the leftover "ICO" line is
fixed, and a retention sentence the product could not be shown to keep was dropped (it stays a finding, A2).

## Verification
Playwright not run locally (temp clone, no node_modules); CI runs build and Playwright on the PR.

## Verdict
Leave the PR open: changing live legal text needs the owner's explicit OK on card #6063 (legal skill, section 6).
