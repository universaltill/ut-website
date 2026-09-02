# Code review: `/pilot` landing page (ut-docs#1434)

**Branch:** `feat/1434-pilot-landing-page` · **Repo:** `ut-website`
**Complexity tier:** easy (re-scoped down from the card's original `easy`
label at pick time — see "Scoping" below) · **Reviewer:** fresh-context
Sonnet subagent (this pipeline's `complexity:easy` review tier)

## What shipped

ut-docs#1434 reported that the 2026-09-02 LinkedIn launch post invites
cafés/shops to get in touch about the free pilot, but universaltill.com had
no contact/pilot path at all — `/pilot` and `/contact` both 404, and the
home page carried no contact link. This PR adds `site/pilot.html`, routed at
`/pilot` in all 5 site locales (en-gb, tr-tr, zh-cn, fa-ir, de-de) via
`staticwebapp.config.json`, with:

- Three lines on what a pilot gets (free, we set it up with you, you keep
  your data) and what we ask (feedback, a shadow run before going live).
- A `mailto:support@universaltill.com` CTA with a prefilled subject and a
  body template asking for shop name / city+country / current till /
  preferred language — the same `mailto:` pattern already shipping on
  `store.html`'s "Email me when it opens" CTA.
- Links from the home page hero (`hero.pilotlink`) and the download page
  (`dl.pilotlink`).
- Full i18n: 14 new keys, all 5 locales, verified by
  `scripts/check-i18n-keys.js`.

## Scoping

The card's full ask also included a JS relay endpoint (stores the lead,
emails the product owner, auto-files a Triage board card) with rate
limiting and a honeypot. That's a separate `ut-cloud` change with its own
persisted-PII, new-credential and spam-protection design questions — not a
same-day "easy" addition to a static marketing page. Scoped this PR to the
static page + `mailto:` fallback, which alone resolves the reported "dead
end" (works with zero backend and zero new secrets), and left the relay +
lead storage + Triage auto-filing as follow-up sub-cards. ut-docs#1434
relabeled `epic`; this PR is sub-card 1. See the commit message and the
issue thread for the full split.

## Independent review

Findings (both non-blocking, from a fresh-context Sonnet review that
actually ran the scripts/build/tests rather than reading the diff cold):

1. **Non-blocking** — "Germany and the UK" is hardcoded in `pilot.lede`
   across all 5 locales. Accurate today (it's what the LinkedIn post says),
   but if the pilot's geographic scope changes this needs a 5-locale text
   edit. Not fixed — reflects current, real business scope; noted for
   whoever next changes the pilot's target markets.
2. **Non-blocking** — no dedicated test asserted the mailto `href`'s exact
   content or that the hero/download links point at `/pilot`; the green
   coverage those routes got (CSP/sitemap tests) was incidental, derived
   automatically from `staticwebapp.config.json`, not intentional
   regression protection for the mailto content itself. **Fixed**: added
   `tests/pilot-page.spec.js` (16 new cases) asserting the mailto address/
   subject/body template in every locale (parsed via `URL`/
   `URLSearchParams`, not regex), the hero/download `/pilot` links in every
   locale, and `fa-ir/pilot`'s RTL `dir`.

No blocking findings. Verdict: **safe to merge**.

## Verified

| Check | Result |
|---|---|
| `node scripts/check-i18n-keys.js` | OK — 5 locales, 191 keys used across 10 pages |
| `node scripts/check-swa-config.js` | OK — no admin/CMS config drift |
| `npm run build` | 20 pages built, no errors |
| `node scripts/generate-csp.js --check` | OK — 3 hashes, unchanged (no new inline `<script>`) |
| `npx playwright test` (full suite) | **156/156 passed** (133 pre-existing baseline on `main` + 7 CSP/sitemap cases auto-derived from the new routes + 16 new `pilot-page.spec.js` cases) |
| Visual check | `en-gb`, `de-de`, `fa-ir` screenshotted manually — RTL mirrors correctly, layout intact |

## Deferred (new Backlog cards, see ut-docs#1434's epic thread)

- The JS relay endpoint in `ut-cloud` (lead storage + email-the-owner via
  the existing `internal/notify` mailer + rate limiting + honeypot).
- Auto-filing a `pilot-lead`-labelled Triage card per submission.

## Not fixed (accepted, not this PR's scope)

- Updating the LinkedIn page's own "website" field to point at `/pilot` —
  an out-of-band manual action on a platform this pipeline has no access
  to; noted in the closing comment on ut-docs#1434 for the product owner.
