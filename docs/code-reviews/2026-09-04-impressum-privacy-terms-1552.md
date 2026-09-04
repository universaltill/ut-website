# Code review: Impressum, privacy policy and terms of use pages (ut-docs#1552)

- **Card:** ut-docs#1552 (p1, `complexity:medium`) — the company's registered
  office changed, and the public site had no Impressum, privacy policy or
  terms page at all, with a German pilot launch imminent.
- **Repo / branch:** `universaltill/ut-website`, `feat/1552-impressum-privacy-terms`.
- **Dev model:** Sonnet (inline, session model matches the card's tier).
- **Review model:** Opus, fresh-context subagent, `isolation: "worktree"`.

## What shipped

- A new Astro content collection, `legal` (`src/content.config.ts`), sibling
  to the existing `blog` collection — chosen deliberately over cramming
  long-form legal prose into `site/i18n.js`'s short-string dictionary, since
  a full legal document has the same "translated per locale, honest English
  fallback when a translation doesn't exist" shape a blog post does, not the
  short reusable-string shape `site/i18n.js` solves.
- Three English documents: `src/content/legal/en-gb/{impressum,privacy,terms}.mdx`,
  with the current registered office (82 A James Carter Road, Mildenhall,
  Suffolk, England, IP28 7DE), company number (11442274) and contact email
  (support@universaltill.com).
- `src/lib/legalPages.ts` and `src/pages/[...lang]/legal/[slug].astro` —
  parallel to `blogPosts.ts`/`blog/[slug].astro`, reusing the existing
  `isFallback` + `news.untranslated` mechanism rather than minting new
  locale keys that would themselves need translating.
- Footer links to all three pages on every page: the six `site/*.html`
  marketing pages and `BaseLayout.astro` (covering `/blog` and `/plugins`).
- `sitemap.xml.ts` updated to list the 15 new locale × page URLs;
  `staticwebapp.config.json` gained the matching unprefixed-redirect
  entries, mirroring the existing `/blog`/`/plugins` pattern.
- `scripts/guard-compliance-claims.sh` extended with a fourth, independently
  fail-closed surface (`src/content/legal/**/*.mdx`) — the `.astro` glob it
  already had never matched `.mdx`, so without this the new pages would have
  shipped with zero compliance-wording coverage.
- Tests: `tests/legal-pages.spec.js` (new — footer link presence and
  locale-continuity, fallback-vs-real-content rendering, factual content
  checks) and `tests/seo.spec.js` (sitemap-count math extended to include
  the legal pages, derived from the real content directory, not hardcoded).

## Deliberately out of scope, split to ut-docs#1553 (Admin Review)

D&B/D-U-N-S record update, the fiskaly MSA's VAT-number field (ADR-0058
already confirms UK VAT registration — this is a lookup, not a decision),
whether the new office is residential (blocks the DSA trader-display
question), and the Impressum's missing authorised-representative name
(Companies House and OpenCorporates lookups were both blocked by this
session's network egress policy). None of these are engineering work.

## Independent review — findings and disposition

Opus reviewed the diff in an isolated worktree: ran `npm ci && npm run
build`, every CI guard script, the full Playwright suite (167/167 passing
pre-fix), and read the rendered `dist/` output for both an English and a
fallback-locale page. Full findings and the review's own verdict are worth
reading in the subagent transcript; disposition here:

| # | Finding | Severity | Fixed? |
|---|---|---|---|
| F1 | `guard-compliance-claims.sh` never scanned `src/content/legal/**/*.mdx` — the exact blind spot the guard exists to prevent | blocker | **Fixed** — added as a fourth fail-closed surface (`LEGAL_DIR`), with matching coverage added to `guard-compliance-claims_test.sh` (planted-term, empty-dir, and allow-marker cases) |
| F2 | Footer links on Astro pages (`BaseLayout.astro`) were hardcoded unprefixed (`/legal/impressum`), unlike every other link in that file (which goes through `L()`) — a German/Turkish/Persian/Chinese reader clicking "Impressum" from `/de-de/blog` was silently ejected into `en-gb` | blocker | **Fixed** — routed through `L()`; added a regression test (`tests/legal-pages.spec.js`, "stays in that locale") |
| F3 | `machineTranslated` declared on the `legal` schema but set by nothing and rendered by nothing — `scripts/translate-posts.js` only knows about `src/content/blog/` | should-fix | **Fixed** — dropped the field; documented in `content.config.ts` that it comes back paired with the render-side check once a real translation pass for `legal/` exists |
| F4 | The "last updated" date line wasn't `dir`/`lang`-corrected on a fallback page, unlike the `<h1>` and body — the exact defect class `blog/[slug].astro` already carries a reviewed fix for (ut-docs#353) | should-fix | **Fixed** |
| F5 | The Impressum's opening sentence read as asserting a complete §5 DDG disclosure while the required representative name is missing, and the only caveat was an MDX comment invisible to any reader | should-fix (content) | **Fixed** — reworded the opening to describe what's published rather than which statute it satisfies, and made the caveat a visible note on the page |
| F6 | "Task Runner Technology Ltd is registered for UK VAT" asserted without a VAT number, on the same page whose own follow-up card says the number isn't settled yet | should-fix (content) | **Fixed** — removed the line; the real number goes in once ut-docs#1553 resolves it |
| F7 | The EU ODR platform link may be stale (the reviewer's information suggests the platform was decommissioned mid-2025); neither the review nor this session could verify it — this environment's network egress is blocked to `ec.europa.eu`, Wikipedia, and general web domains, GitHub excepted | should-fix (content) | **Fixed conservatively** — removed the specific platform link rather than publish an unverifiable legal reference; kept the still-valid "we don't participate in consumer arbitration board proceedings" sentence; flagged for a human to double-check on ut-docs#1553 |
| F8 | Privacy policy's "no cookies... nothing to opt out of" omitted the one thing the site *does* store (`localStorage.ut_lang`) | should-fix (content) | **Fixed** — one sentence added |
| F9 | Privacy policy names no GDPR Art. 13(1)(c) lawful basis, and no Art. 27 EU-representative statement | nit (content, legal judgement) | **Deferred** — added to ut-docs#1553 alongside the representative-name item |
| F10 | `.foot-legal` had no CSS rule, inheriting default `<p>` margins unlike its siblings | nit | **Fixed** — three rules added to `styles.css` |
| F11 | The `·` separator rendered with different surrounding whitespace on Astro vs static pages (Astro's HTML compression eats the newline+indent a static page keeps) | nit | **Fixed** as part of the F2 change — real space characters around `{' · '}` |
| F12 | `tests/legal-pages.spec.js`'s `HOME_PAGES` omitted `/en-gb/language`, a file this diff also edited | nit | **Fixed** |
| F13 | `<meta name="description">` duplicated the page `<title>` on all three legal pages | nit | **Fixed** — added an optional `summary` frontmatter field |
| F14 | README undocumented the new collection/resolver/sitemap contribution | nit | **Fixed** |

**The one architectural judgement call worth recording:** the review
explicitly signed off on shipping the three page *bodies* English-only in
`tr-tr`/`zh-cn`/`fa-ir`/`de-de` (the homelab Ollama translation endpoint —
`reference/translation.md` — is confirmed unreachable from this cloud
session, same blocker as ut-docs#1292; the fallback is honest and visible,
not silent), while pushing back specifically on the **footer link labels**:
three short, fixed-vocabulary terms rather than long-form prose, where the
translation-endpoint constraint is a much weaker justification. Resolution:
`foot.impressum` now uses the bare word "Impressum" in every locale — not a
translation of "legal notice", but the actual name of the DDG obligation
this page exists for, already the standard label on multilingual sites
regardless of UI language — while `foot.privacy`/`foot.terms` remain
English placeholders under the same documented constraint as the page
bodies.

## Verified beyond automated tests

- Rebuilt after every fix; re-ran `check-i18n-keys.js`,
  `guard-compliance-claims.sh` (+ its own test script),
  `check-swa-config.js`, `generate-csp.js --check`, `check-brand-assets.sh`,
  and the full Playwright suite (169/169 passing) against the fixed diff,
  not just the pre-review version.
- Manually inspected the built HTML for `dist/en-gb/legal/impressum/`,
  `dist/de-de/legal/impressum/` and `dist/de-de/blog/index.html` after the
  F2/F4/F5/F13 fixes to confirm: valid markup (no `<p>`-in-`<p>` nesting),
  the footer link now resolves to `/de-de/legal/impressum` and its label
  renders as "Impressum" once `i18n.js` applies, and the fallback page's
  date line is correctly forced `ltr`/`en`.
- Re-verified the byte-for-byte `site/` → `dist/` pass-through check the
  `build` CI job runs, and the git identity on this branch, immediately
  before this commit.

## Safe-to-merge verdict

Safe to merge. All CI-blocking checks pass locally against the final diff;
every blocker- and should-fix-level finding from the independent review is
resolved; the two remaining items (F9's GDPR Art. 13/27 language, plus the
already-tracked director name/D&B/VAT/DSA items) are genuine business/legal
questions, not engineering gaps, and are on ut-docs#1553 for the product
owner.

## Explicitly deferred

- Real translation of all three pages, and of `foot.privacy`/`foot.terms`,
  into tr-tr/zh-cn/fa-ir/de-de — needs a local session (homelab Ollama
  endpoint) and, for the legal collection specifically, `scripts/
  translate-posts.js` extended to know about `src/content/legal/` first.
- ut-docs#1553: D&B/D-U-N-S update, fiskaly MSA VAT number, the
  residential-address/DSA-trader-display decision, the Impressum's
  authorised-representative name, and (added by this review) the privacy
  policy's GDPR Art. 13 lawful-basis statement and Art. 27 EU-representative
  question.
