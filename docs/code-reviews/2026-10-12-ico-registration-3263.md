# Review — ICO registration number on the website and in the compliance reference (ut-docs#3263)

**Shipped:** the company's ICO data-protection registration **ZC263752**
(certificate on ico.org.uk: registered 2026-09-30, expires 2027-09-29) cited
on the website privacy page ("Who we are") and the legal notice. Every locale
renders the single English legal source. `reference/uk-compliance.md` §10, the
Art. 28 list, the obligations table and the card index say the fee is done.

**Reviewer:** independent Sonnet subagent (the change was written by Opus 5.5).

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | Medium | Three more "registration number pending" lines in uk-compliance.md | Fixed |
| 2 | Low | "registered as a data controller" is imprecise: the ICO register records fee payers | Fixed: "paid the UK data protection fee and are registered with the ICO" |
| 3 | Low | Dates only in the docs, not on the site | Accepted: the number alone is the disclosure |

**Verified:** the number and dates match the certificate; `npm run build` exit 0;
ZC263752 present in privacy and impressum for en-gb, de-de, tr-tr, fa-ir and
zh-cn; `dist/` is untracked build output.

**Verdict:** safe to merge.
