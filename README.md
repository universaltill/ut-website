# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — the plain-HTML marketing site (every locale in the published list). Deliberately **not**
  rewritten into Astro components: it is proven and multilingual, and
  re-transcribing ~500 translated strings by hand would risk silently
  introducing translation bugs. `astro.config.mjs` sets `publicDir: 'site'`,
  so Astro copies this tree into `dist/` **byte-for-byte unchanged**. Edit
  these files exactly as before.
- Astro builds only genuinely *new* surface on top of that: the blog
  (`src/content/blog/`, MDX content collections), `/plugins`, and the
  Impressum/privacy/terms pages (`src/content/legal/`, ut-docs#1552 — same
  collection-plus-fallback shape as the blog, via its own
  `src/lib/legalPages.ts` and `src/pages/[...lang]/legal/[slug].astro`,
  because long-form legal prose has the same "translated per locale,
  fall back to English honestly" problem a blog post does, not the short
  reusable-string problem `site/i18n.js` solves). See
  `docs/astro-migration.md`.
- **SEO plumbing (ut-docs#482):** every blog post carries a JSON-LD
  `BlogPosting` block; `sitemap.xml` covers the blog, `/plugins`, the legal
  pages, and the `site/` marketing pages in every locale (built from
  `site/staticwebapp.config.json`'s route table, not a hand-kept copy of
  it); each locale gets its own RSS feed at `/{locale}/blog/rss.xml`,
  discoverable via a `<link rel="alternate" type="application/rss+xml">`
  on every Astro-rendered page (blog index/posts, `/plugins`, legal — the
  plain `site/*.html` marketing pages don't carry it, same as they don't
  carry BaseLayout's other `<head>` mechanics). `src/lib/blogPosts.ts` is
  the one place "which posts exist, in which locale" is decided — the blog
  index, the sitemap and every RSS feed all read from it; `src/lib/
  legalPages.ts` is the same thing for the legal pages, deliberately kept
  as a separate, parallel file rather than a shared abstraction across two
  collections that happen to look alike today but don't have to stay that
  way (blog gained `draft`/date-sorting/`excerpt` over time; legal
  hasn't needed any of that yet).
- **`/plugins` and one page per plugin (ut-docs#4645).** The grid is small
  cards (logo, name, one-line tagline, type + Free badges) and each card links
  to `/<locale>/plugins/<slug>/` (slug = repo name minus `ut-plugin-`), which
  carries the full description, screenshots, version, minimum till version,
  devices, publisher, permissions (plain-language line + raw name) and the
  download. The plugin list is `src/lib/plugin-list.json`; `src/lib/plugins.ts`
  fetches each `manifest.json` once per build and is what the grid, the pages,
  `sitemap.xml` and `/plugin-assets/` all read. A manifest's
  `resources.icon`/`resources.screenshots` are copied into the build (PNG/JPEG/
  WebP only, checked by magic bytes, size-capped; never SVG) so the CSP's
  `img-src` stays `'self'`; no icon → a coloured letter mark. A failed fetch
  drops that plugin or picture with a warning, never the build.
  `src/lib/plugins_test.mjs` (`node --test`, fetch stubbed) and
  `tests/plugin-pages.spec.js`.
- **Public help pages (ut-docs#5355, part of #4504)** - `/<locale>/help/` (index
  grouped by section, with a filter) and `/<locale>/help/<topic>/` in every
  locale. The text is NOT in this repo: it is the product manual,
  `web/help/<folder>/*.md` + `web/help/img/<folder>/<id>.png` in the public
  `universaltill/universal-till` repo (folders `en de tr fa`; `zh-cn` has none,
  so English stands in; the product's `ar` folder is deliberately not published
  and has no site locale). `src/lib/helpSource.ts` makes a sparse, shallow
  clone into `.help-src/` (git-ignored) at **`HELP_REF`** (a tag or branch name, not a SHA), else the product's
  latest release tag (GitHub API, then the highest `vX.Y.Z` from `git ls-remote`),
  else - local builds only, with a warning - `main`; with `CI`/`GITHUB_ACTIONS`
  set and no ref found the build **fails**. It logs the ref
  (`[help] source: ... @ v0.35.3`). `HELP_SRC_DIR=<a web/help dir>` skips the
  clone (tests, offline work). If the source cannot be had the **build fails**
  - there is no committed copy to go stale; every entry point
  (`npx astro build`, `npm run build`, the Playwright web server) does this
  itself. `src/lib/help.ts` strips front-matter, renders Markdown with
  `@astrojs/markdown-remark`, rewrites `/help/<slug>` links to
  `/<locale>/help/<slug>/` (plain text when the topic is not public), turns
  any other till route into plain text, adds `rel="noopener"` to external links
  and wraps tables so they scroll. **Which topics are public:** front-matter
  `public: true`, or a slug in `data/help-public-allowlist.txt` (temporary,
  delete it once the product repo carries the flag, the build and guard work
  without the file). `public` must be exactly unquoted `true`/`false`, anything
  else is NOT public; `public: false` always wins. The allow-list is advisory:
  a listed slug that is missing upstream or `public: false` only WARNS, a topic
  with an unsafe slug or unparseable front-matter is skipped with a warning, a
  bad screenshot (not PNG / too big) is dropped with a warning, so a product
  release cannot break the deploy. The build writes what it published to
  `.help-build/manifest.json` (git-ignored); the guard and the Playwright spec
  read that, not the allow-list. Screenshots are
  copied to `/help-img/` (PNG magic bytes, <= 1MB) so CSP `img-src` stays
  `'self'`. A locale without a translation shows the English text with a notice,
  canonical to en-gb, no hreflang, out of the sitemap (#3811). The filter is
  `site/help.js` (external, deferred; with JS off the list is complete and the
  form stays hidden). Checks: `node --test src/lib/help_test.mjs`,
  `scripts/guard-help.mjs` after `astro build` (every topic in every locale,
  internal links/anchors/images resolve, no orphan image, no front-matter
  leakage, compliance denylist over the rendered text, sitemap vs canonicals;
  test: `node --test scripts/guard-help_test.mjs`) and
  `tests/help-pages.spec.js`. Not yet done: a Help link in the nav/footer
  (every header is compared by `site-consistency.spec.js`, so it is its own change).
- **Platform landing pages (ut-docs#4643)** — `site/android-till.html` →
  `/<locale>/android-till`, a marketing template like the others (routes in
  `staticwebapp.config.json`, keys in `site/i18n.js`). Each platform page is
  distinct (its own devices, setup, limits and FAQ — never another page with
  the device name swapped) and says only what is true today. Its FAQ uses a
  page-local namespace (`android.faq.qN`/`aN`) and still gets `FAQPage`
  JSON-LD; `<meta name="ut:software-os" content="Android">` adds a
  `SoftwareApplication` block built from the page's own meta description.
  Linked from the home hardware section and the download page's Android card.
  `tests/android-till-page.spec.js`.
- **"Find your setup" wizard (ut-docs#4193)** — `site/find-your-setup.html` →
  `/<locale>/find-your-setup`, linked from the home hero and the main nav (home,
  every `site/*.html` page and `BaseLayout.astro`) in every locale. Six optional
  questions (business type, country, locations, needs, card provider, hardware)
  → a recommended plan with its real price, hardware, plugins, "good to know"
  notes, an honest **Not yet** list, and a next step: the free **Local** plan
  goes to `/<locale>/download`, any cloud plan to
  `https://my.universaltill.com/<locale>/`, Enterprise and chains to the
  support mailbox. **All decisions are one data table in
  `site/wizard-rules.js`** (`PLAN_RULES`, `GAPS`, `NOTES`, `PLUGINS`, `PRICES`);
  `site/wizard.js` only draws questions and the answer, reading every string
  from the `wiz.*` keys in `i18n/en.json` (every published locale; plan names stay
  untranslated). Prices come from `data/plan-prices.json` (below) for
  the UK, Germany and the eurozone only; any other country shows "not published
  yet", never a guess. The answers live in memory only: no storage, no request,
  no analytics (lead capture with consent is ut-docs#2550). With JS off the page
  still shows the two plain links; `a[data-my-link]` gets the page's locale at
  build time (`marketingPages.ts`) and in the browser. To change a
  recommendation, edit the table and `tests/wizard-rules.spec.js`;
  `tests/wizard.spec.js` drives every locale in Chromium.
  **Prices have one source (2026-10-24):** `data/plan-prices.json` is a byte-identical
  copy of `ut-docs/reference/plan-prices.json` (minor units); `node scripts/gen-plan-prices.mjs`
  turns it into `site/plan-prices.js` (committed, CI-checked), which `wizard-rules.js`
  reads - no plan amount is typed in site/ or src/. `scripts/guard-plan-prices.sh` fails
  on a retired price (Shop 42, Pro 59, Multi-location 127, 35.00/49.17/105.83) and on a
  stale generated file; run with `PLAN_PRICES_UPSTREAM=<ut-docs main file>` it also
  checks the copy is identical to ut-docs main. ut-docs is private and this repo is
  public, so CI here holds no ut-docs token: the equality check runs on the ut-docs
  side. Every "Get started" button (header, hero, every page and locale) opens the
  wizard at `/<locale>/find-your-setup` (`tests/cta-wizard.spec.js`); the wizard's
  last step is the only link on to my.universaltill.com.
- **Home page copy (ut-docs#4203).** `site/index.html` order: hero, `#why`
  (4 cards), `#free`, `#switch`, then the older sections, with `#close` (the
  closing "Start free" CTA + support mailbox) last. Claims there are checked
  against shipped behaviour: "no minimum term" (not "no contract" - annual
  billing exists) and, in `de-de` only, the managed TSE exception to "never
  charged per till". Every English headline "no minimum term" claim
  (`hero.lede`, `why.exit.d`, `start.lede`, `meta.home.desc`) carries
  Germany's managed-TSE exception in the same sentence (ut-docs#5485);
  `why.exit.d`, `faq.a2` and the wizard's `wiz.n.detsemin` / `wiz.price.tsemin`
  lines name the 12-month minimum, pinned to `data/plan-prices.json`
  (ut-docs#5473). `tests/home-copy.spec.js`.
- **`/llms.txt` and `/llms-full.txt` (ut-docs#4319)** — the llmstxt.org
  summary of the site for AI assistants, plus the full English home copy and
  every en-gb blog post as Markdown. Generated at build by
  `src/lib/llmsText.ts` from `site/i18n.js` (in the home template's own
  section order), `src/lib/blogPosts.ts` and `src/lib/legalPages.ts` — never
  edited by hand. `staticwebapp.config.json` serves `.txt` as UTF-8.
  `tests/llms-txt.spec.js` checks every link answers 200 and the FAQ is
  carried verbatim. The home FAQ itself (ut-docs#4320) emits `FAQPage`
  JSON-LD from the same keys it renders.
- **Marketing pages are prerendered per locale (ut-docs#3480).** `site/*.html`
  is the template; `src/pages/[lang]/[file].ts` (logic in
  `src/lib/marketingPages.ts`) emits `dist/<locale>/<page>.html` with the
  `site/i18n.js` dict already applied — `<html lang dir>`, every
  `data-i18n*` string, the `<title>` and meta description (`meta.<page>.*`
  keys, via `data-i18n-content`), a self-referencing canonical and the full
  hreflang set — so a crawler gets `/de-de` in German without running JS.
  Each locale route in `staticwebapp.config.json` rewrites to
  `/<locale>/<page>.html`; i18n.js still runs on top for language switching.
  `site/robots.txt` allows everything and names the sitemap.
  `tests/seo-prerender.spec.js` checks all of it on the raw, JS-free response.
- **Links point at final URLs only (ut-docs#3798).** The prerender rewrites
  the templates' unprefixed links (`/download`, `/legal/privacy`) to
  `/<locale>/download` and `/<locale>/legal/privacy/`. Astro pages' canonical
  form ends in `/` and every link uses it. Links to the noindex language
  picker are `rel="nofollow"`, and the raw templates (`/index.html` …) 301 to
  `/en-gb/…`. `tests/internal-links.spec.js` fails on any link, canonical or
  hreflang from a sitemap page that doesn't answer 200 as its own canonical.
  The apex → www 301 is Static Web Apps' *default domain*, set in the portal
  (not settable via Terraform); `deploy.yml` checks it live after each deploy.
- **Analytics only after consent (ut-docs#3507).** `site/consent.js` (loaded
  `defer` after `i18n.js` on every page, `site/*.html` and `BaseLayout.astro`)
  builds the cookie banner and the footer "Cookie settings" button, keeps the
  choice in `localStorage.ut_consent`, and injects Google Analytics 4
  (`G-6WZY1CZ94Q`) only after Accept — nothing reaches Google before that.
  Reject after Accept deletes the `_ga*` cookies. The GA4 hosts in the CSP live
  in `scripts/generate-csp.js` (`GA_HOSTS`/`GA_SCRIPT`); the privacy policy
  describes it. `tests/consent.spec.js` checks no Google request before consent,
  the tag + Consent Mode signals after Accept, Reject, withdrawal, translations.
- **Responsive screenshots (ut-docs#3493, #3516).** Each full-size screenshot
  `site/images/<name>.webp` has `<name>-{480,640,768,1024,1280}.webp`
  beside it, listed in the `<img srcset>` with a `sizes` that matches the real
  CSS layout. After replacing a screenshot run `scripts/make-image-variants.sh`
  (needs `cwebp`) and commit the output; convert any PNG to WebP first
  (`cwebp -q 85 in.png -o out.webp`). `tests/responsive-images.spec.js` fails
  if a variant is missing, lies about its width, or the browser would pick a
  blurry or more than 1.4× oversized one at phone, tablet and desktop widths,
  including PageSpeed's own emulation (412px × 1.75, 1350px × 1).
- **An untranslated page points search engines at its English original
  (ut-docs#3811).** A legal page or post that a locale serves as the English
  fallback carries a canonical to the `/en-gb/…` URL, is left out of
  `sitemap.xml`, and isn't declared as an hreflang alternate (only real
  translations are, via `translatedLangsOf` in `src/lib/legalPages.ts` /
  `blogPosts.ts`) — otherwise Google sees the same English text under five
  URLs and drops them as duplicates. The Astro pages' chrome (nav, footer)
  and `/plugins`' own copy (`pluginspage.*` keys) are rendered from
  `site/i18n.js` at build time (BaseLayout's `t()`), so the raw HTML is in
  the page's language before any JS runs. `tests/untranslated-duplicates.spec.js`.
- **The Decap CMS admin does NOT live here.** It's served from the homelab
  cluster at `cms.universaltill.com`, gated by Zitadel via oauth2-proxy
  (`taskrunnertech/homelab-k8s`'s `kubernetes/apps/ut-cms/`) — this SWA
  intentionally has no `/admin` route and no `auth` block; `site/admin/*` and
  `/admin` are explicitly excluded from `navigationFallback` so a request to
  either 404s cleanly instead of silently serving the homepage
  (ut-docs#461/#471). Decap's GitHub OAuth relay (`api/auth` + `api/callback`)
  moved there too and is **gone from this repo** — it has to be same-origin
  with the CMS, because Decap's popup `postMessage` is origin-pinned
  (ut-docs#468). `scripts/check-swa-config.js` (CI) fails if any of it returns.
- **…but its source is built here, as images (Phase 2 card C4, ut-docs#4998).**
  Azure Container Apps has no ConfigMaps, so the admin page + nginx config
  (`cms/web/`) and the OAuth relay (`cms/relay/relay.js`) are baked into
  `ghcr.io/universaltill/ut-cms-web` and `ghcr.io/universaltill/ut-cms-relay`
  by `.github/workflows/cms-images.yml` (main only; multi-arch, cosign-signed,
  tagged by commit sha; the digests are in the run summary). Neither image
  holds a secret: the GitHub OAuth client id/secret reach the relay at run
  time as files under `SECRETS_DIR`. Nothing in `cms/` is served by the SWA
  (it ships `dist/` only). Tests: `node --test cms/tests/*.test.js`; runtime
  smoke: `WEB_IMAGE=… RELAY_IMAGE=… bash cms/scripts/smoke.sh`. New GHCR
  packages start private: after their first publish the owner flips both to
  public once (package settings; no API), or the deployer cannot pull them. Until the
  homelab deployment switches to these images, homelab-k8s's ConfigMaps are
  a second copy — change both.
- **There is a build step now**: `npm ci && npm run build` → `dist/`, which is
  what gets deployed. `dist/`, `.astro/` and `node_modules/` are git-ignored.
  `package.json`'s `devDependencies` also carry Playwright (`tests/`,
  test-only, never part of what ships). After `astro build`,
  `scripts/postbuild.mjs` (ut-docs#3520) inlines `site/styles.css` into every
  built page and minifies `i18n.js`/`nav.js`/`consent.js` with esbuild, so
  edit the readable sources in `site/` and never hand-edit `dist/`.
  `tests/build-assets.spec.js` fails if a page links `/styles.css` again or a
  script ships unminified.
- **Every page has a URL per locale, English included**: `/en-gb/…`, `/de-de/…`
  and so on for every locale in the **published list** (below). Region-tagged
  because VAT, receipt law and payment rails differ by country, not by
  language — and prefixed even for the default, because an unprefixed URL
  states no language. `site/i18n.js` derives the locale from the first path
  segment, path beating any stored choice; the Astro pages build one file per
  locale; the generated `staticwebapp.config.json` maps the prefixed
  pretty-URLs and 301s every older URL (`/`, `/blog`, `/download`, `/tr`, …).
  The globe carries the current page (`/language?from=…`) so choosing a
  language returns you where you were.

## Published locales (ADR-0177, ut-docs#5406) — no locale is named in code

The locale set is **data**: `i18n/published/locales.json` (the file
`ut-translations` publishes; schema 1) plus `i18n/<url-locale>.json` (approved
strings, flat key → text) and `i18n/en.json` / `en.meta.json` (the English
source and translator metadata, edited here). Nothing else lists a locale.

- **Seed (today).** Weblate has no `website` component yet, so the files for the
  five live locales were produced once by `scripts/seed-published-locales.mjs`
  from the old hand dictionaries (every non-English locale is `machine_label`,
  `legal_approved: false`, legal-tier keys omitted). The future
  `sync-locales.yml` overwrites exactly these files from `ut-translations@main`
  (`published/locales.json`, `published/website/<code>.json`). **ar, fr, ms, pt,
  es and it are not translated here and are not faked:** they appear on the site
  automatically (routes, pages, hreflang, sitemap, switcher, band) the day
  ut-translations publishes them for the `website` surface and the files land.
- **Generator.** `node scripts/gen-locales.mjs` writes `site/i18n-data.js` (the
  dictionaries `i18n.js` runs on; `i18n.js` is logic only) and the locale part of
  `site/staticwebapp.config.json` (routes, short aliases `/de`, withdrawn-locale
  301s; every hand-kept entry is preserved). `--check` is the CI guard. It
  refuses a string file for a locale that is not published, a key not in
  `en.json`, an empty value, a `core` key missing from a published locale, and
  any HTML-bearing value outside the allow-list (`a[href] b i em strong br span
  code`, no handlers or script URLs, tag set and link targets equal to English).
- **Build.** `src/lib/locales.ts` (via `scripts/lib/locales.mjs`, shared with the
  generator, guards and specs) gives the Astro pages and the marketing prerender
  `LANGS`, direction, BCP-47, the AI label and the my. locales. `<html lang dir>`,
  canonical, hreflang + `x-default`, the sitemap and the `/language` picker are
  all produced from it. `UT_I18N_DIR` / `UT_OUT_DIR` point a build at another
  list (the fixture builds).
- **Per-key English fallback.** A key a locale does not ship renders the English
  text in `<span lang="en" dir="ltr" data-i18n-fallback>`; the page shows
  `site.fallback_note` once, under the header, only when such a span exists.
- **"Translated with AI" (owner decision 2026-11-04).** Any locale whose list
  entry has no recorded human review (`machine_label`) gets, prerendered on every
  page: the notice band (`role="note"`, not dismissible, English link to the same
  page, `mailto:` report link), the report link in the footer and an `AI` badge on
  its `/language` card. When the list says `human_reviewed` they all disappear
  with no code change. The branded 404 (one file for every locale) builds the band
  in the browser. Copy and a11y: UX spec in ut-docs#5405; keys `site.machine_label*`.
- **Legal pages** are the English text, canonical to `/en-gb/…`, outside hreflang
  and the sitemap, under the in-language `site.legal_english_binding` notice,
  unless `surfaces.website.legal.<doc>` (or `legal_approved`) is true for that
  locale **and** a translated MDX exists. Footer and cookie-banner legal links
  always resolve (`tests/locale-label.spec.js`).
- **Blog.** Locale directories under `src/content/blog/` must be published
  locales (`check-locale-consistency` fails on a stray one). A post exists in a
  locale only where translated; elsewhere the English page is served with the
  "available in English" note, canonical to English. A machine-translated post
  (`machineTranslated: true`) in a locale with the AI label is `noindex`, canonical
  to English and out of hreflang and the sitemap unless the post says
  `reviewed: true`. `llms.txt` stays English.
- **Guards.** `scripts/check-locale-consistency.mjs` (after a build) fails when
  routes, pages, hreflang, canonical, sitemap, switcher, band/badge, my. links or
  content directories disagree with the list, or an `--absent` locale leaks.
  `node --test scripts/locale-fixtures_test.mjs` does two real builds: a list with
  `ms-my` and `ar-sa` added (appear everywhere, rtl for ar, label, fallback,
  English-only legal; one human-reviewed locale loses the label) and a list
  without `fa-ir` (no route, page, sitemap, hreflang or switcher entry, only a
  withdrawn 301 may name it). The Playwright specs iterate the list through
  `tests/helpers/locales.js`.

- **Posts are translated, not just the chrome.** English posts live in
  `src/content/blog/en-gb/` and are the only ones written by hand (that is the
  folder the CMS files into). Translations into a published locale's folder (today `tr-tr/`, `zh-cn/`, `fa-ir/`
  and `de-de/`) are written by the pipeline cycle's own model (Claude or
  Codex, whichever is running the Dev step) directly into those folders,
  following the checklist in `ut-docs/reference/translation.md`, and
  committed like any other content — so the site depends on files in git
  rather than on a model being up when someone builds (ut-docs#2291 retired
  the self-hosted Ollama endpoint this used to call for build-time
  translation; the in-product runtime translation paths are unaffected, see
  that doc). Translations carry `machineTranslated: true` and say so on the
  page, with a link to the English original. A missing translation is not an
  error: that locale falls back to English and tells the reader.
  `node scripts/translate-posts.js` is a pure, no-network checker (runs in CI
  — see `check-translate-posts` in `.github/workflows/ci.yml`) that flags a
  committed translation which drops a section, rewrites a link, translates
  the product name, or comes back in the wrong script/untranslated.
- **There is no `navigationFallback`.** It answered every unknown path with the
  homepage at HTTP 200 — which is why `/blog` looked live for weeks before it
  existed, and why `/admin` looked like it was still served. Unknown paths 404.
  `scripts/check-swa-config.js` fails if it returns without excluding `/admin`.
- **Unknown paths get the branded `site/404.html`** via
  `responseOverrides["404"]` (a rewrite, so the status stays 404; ut-docs#3809).
  It is one file for every locale: `i18n.js` localises it from the URL. It is
  `noindex` with no canonical. `/downloads` and `/downloads/` 301 to
  `/en-gb/download`, because that folder only holds per-installer redirects.
- `scripts/check-i18n-keys.js` (run on every push/PR via `.github/workflows/ci.yml`)
  guards the keys: every `data-i18n`/`data-i18n-html`/`data-i18n-aria-label` key
  used across `site/*.html` and `src/**/*.astro` must exist in `i18n/en.json`
  (otherwise the template's hard-coded text shows in every locale and nothing
  reaches translators), and no string file may carry a key `en.json` lacks.
  Missing keys in a locale are not an error: they fall back to English by design.
- `scripts/guard-compliance-claims.sh` + `scripts/guard-compliance-claims_test.sh`
  (ut-docs#702, the `check-compliance-claims` CI job) enforce the
  product-owner-approved fiscal-compliance wording denylist (ut-docs#667) —
  no "GoBD-compliant", "revisionssicher"/"audit-proof", "certified by the
  Finanzamt", or claims of filing a merchant's §146a notification on their
  behalf, anywhere this site's copy can appear: `site/i18n.js`,
  `src/content/blog/**/*.mdx`, `site/*.html`, `src/**/*.astro`, and
  `src/content/legal/**/*.mdx` (ut-docs#1552 — the Impressum/privacy/terms
  pages are exactly the surface most likely to ever state a compliance
  outcome, so they get their own fail-closed check, not a ride inside the
  `.astro` glob, which never matches `.mdx`). Same denylist and
  `compliance-claim:allow` escape-hatch convention as `universal-till`'s own
  `scripts/ci/guard-compliance-claims.sh` — kept in sync by hand across the
  two repos.
- **Content-Security-Policy (ut-docs#442).** `site/staticwebapp.config.json`'s
  `globalHeaders` carries a restrictive CSP (`default-src 'none'`, everything
  else opted in narrowly: `script-src`, `connect-src https://api.github.com`
  for `download.html`'s live-release upgrade, `style-src 'unsafe-inline'` for
  this site's one-off `style="…"` attributes, `img-src data:` for the CSS
  icon masks). `script-src` allowlists inline `<script>` bodies by SHA-256
  hash rather than `'unsafe-inline'` — there's no per-request nonce a static
  host can hand out. `scripts/generate-csp.js` computes and writes that hash
  list from a real `dist/` build rather than it being hand-maintained (a
  script silently drifting out of sync with its hash is exactly the kind of
  gap that stays invisible — a CSP violation doesn't fail a build, it just
  quietly drops the blocked script's effect for a reader — the same failure
  class `check-i18n-keys.js` and `check-swa-config.js` already guard). Each
  blog post's own JSON-LD `<script type="application/ld+json">` is
  deliberately **excluded** from this hash list — CSP's `script-src` only
  ever governs a script whose type is empty/a JS MIME type/`module`/
  `importmap`, so a non-script `type` needs no hash at all (see
  `scripts/generate-csp.js`'s file header for the full story, including the
  mistake an earlier draft made and an independent review caught). Run
  `node scripts/generate-csp.js --write` after `npm run build` whenever an
  *executable* inline script changes and commit the diff; the `build` CI job
  runs `generate-csp.js --check` and fails if the committed hash list
  doesn't match a fresh build. `tests/csp.spec.js` drives real Chromium
  against `scripts/serve-site.js` (which now applies `globalHeaders` to
  every response, not just routes) and asserts zero
  `securitypolicyviolation` events, across every page shape this site
  serves.
- `tests/mobile-nav.spec.js` is a Playwright regression suite covering the
  mobile hamburger nav and the language pill (ut-docs#458) — desktop vs.
  mobile layout, open/close via toggle/link-click/Escape/outside-click, and
  an RTL smoke check on `/fa`. Run it locally with
  `npm ci && npx playwright test` (installs Chromium automatically the
  first time via Playwright's own browser download, or reuses one you
  already have). It also runs on every push/PR via the `playwright` job in
  `.github/workflows/ci.yml`.
- Deploys automatically to an Azure Static Web App (free tier) on push to
  `main` via `.github/workflows/deploy.yml`, which builds with Astro and
  uploads `dist/`. No managed functions — this site is entirely static.
- The Azure resource, DNS zone and deployment token are managed by terraform
  in the `infra` repo (`unitill-infra/website/` — its own isolated state).
  The deployment token lives in Key Vault `kv-unitill-dev` as
  `website-swa-deploy-token` and is mirrored to this repo's
  `AZURE_STATIC_WEB_APPS_API_TOKEN` secret.

## English source for Weblate (ADR-0177, ut-docs#5405)

`i18n/en.json` (flat key -> English text) and `i18n/en.meta.json` (per key a
translator `description`, `placeholders` as `"{name} — meaning"`, optional
`max_length`, `html`, `core`, and `review`: `legal` or `standard`) are the English
source that `ut-translations` syncs into Weblate, and **they are edited by hand**
(since the #5406 cutover the old dictionaries in `site/i18n.js` are gone). New
keys need a metadata entry in the same change; `node scripts/guard-i18n-meta.mjs`
fails on a missing description or review, a placeholder that does not match the
English, or an unknown field (self-test: `node --test
scripts/guard-i18n-meta_test.mjs`). Anything that looks legal, privacy, terms,
cookie-consent or pricing must be `review: "legal"` (only a human-reviewed
translation is published; until then the English text shows) unless it carries a
`review_exception` reason. `core: true` marks the keys every published page frame
needs (the AI label, fallback note, legal notice, language picker); they must be
`standard` and a locale is not published without them.

## Custom domain

`universaltill.com` is registered at GoDaddy. To go live on the real domain:
point the domain's name servers at the Azure DNS zone (terraform output
`dns_zone_name_servers`), then apply the website terraform with
`-var enable_custom_domain=true`.
