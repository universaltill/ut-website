# 2026-08-08 — Blog SEO plumbing: sitemap, RSS, JSON-LD (ut-docs#482)

## What shipped

The card's own premise (BA-verified before design) was partly stale:
`src/layouts/BaseLayout.astro` already shipped per-post `<title>`, meta
description, canonical URL and hreflang alternates site-wide, and the
blog was already fully multi-locale (en-gb/tr-tr/zh-cn/fa-ir), not the
single placeholder post the card described. The real remaining gap —
what this change actually delivers — was narrower:

- **JSON-LD `BlogPosting`** on every post page
  (`src/pages/[...lang]/blog/[slug].astro`): headline, datePublished,
  mainEntityOfPage, inLanguage, author, publisher, and `image` where a
  post sets `coverImage`. Uses the exact same `Astro.url.pathname`
  against `Astro.site` construction as the page's own `<link
  rel="canonical">`, so the two can't disagree about this page's URL.
- **`sitemap.xml`** (`src/pages/sitemap.xml.ts`, new): covers the blog
  index, every published post, and `/plugins` in all 4 locales, plus the
  plain-HTML marketing pages (`site/*.html`) — built from
  `site/staticwebapp.config.json`'s own route table via a **static**
  import (resolved by Vite at build time against the source module, not
  runtime `fs`/`cwd`) so it can't drift from the real SWA route table,
  and excludes any marketing page whose own markup carries `<meta
  name="robots" content="noindex">` (currently `site/language.html`) by
  reading that markup directly rather than a second hand-kept exclusion
  list.
- **RSS**, one feed per locale (`src/pages/[...lang]/blog/rss.xml.js`,
  `@astrojs/rss`, new dependency) at `/{locale}/blog/rss.xml`, matching
  the site's existing per-locale convention rather than a single
  English-only feed — discoverable via a new `<link rel="alternate"
  type="application/rss+xml">` on every Astro-rendered page.
- **`src/lib/blogPosts.ts`** (new): factors "which posts exist, in which
  locale, English-fallback applied" out of `blog/index.astro`'s own
  inline logic into one shared helper, now used by the blog index,
  `sitemap.xml`, `rss.xml`, and `[slug].astro`'s `getStaticPaths` — the
  set of pages that actually exist and everything that lists them read
  from the same source.
- **`tests/seo.spec.js`** (new, 10 tests): sitemap/RSS well-formedness
  (parsed with the browser's `DOMParser`, not string-matching), coverage,
  URL-shape agreement with canonical, and JSON-LD field validity — see
  "Independent review" for how these were tightened.
- Two small pre-existing gaps closed as part of making the sitemap
  correct: `site/download.html` and `site/store.html` were missing the
  `id="canonical"` that `site/i18n.js`'s existing per-locale rewrite
  mechanism (`document.getElementById("canonical")`) needs to actually
  fire — without it, all 4 locale variants of those two pages declared
  the *same* canonical (pointing at the un-prefixed, 301-redirected
  path), which is inconsistent with submitting locale-prefixed URLs for
  them in a sitemap.

## Independent review (Opus, isolated worktree)

Verdict: **safe to merge with the listed fixes applied** — no blockers.
Found and fixed:

- **MINOR** — `tests/seo.spec.js`'s marketing-path list was a hand-copy
  of the same 5 paths `sitemap.xml.ts` reads from config — proven by
  swapping the implementation for a fully hardcoded list and watching all
  10 tests still pass. **Fixed**: the test now derives its expectation
  from `site/staticwebapp.config.json` and the real `site/*.html`
  `noindex` markup directly, the same source files the implementation
  reads, and also asserts an exact `<loc>` count (catches an extra entry,
  not just a missing one). Re-verified by mutating
  `staticwebapp.config.json` (adding a `/pricing` route) against the
  hardcoded-implementation experiment: the fixed test now fails with a
  real count mismatch (36 expected vs. 32 seen).
- **MINOR** — the English-fallback path in `blogPosts.ts` had no fixture
  that actually exercised it (both real posts are fully translated in
  every locale today). Accepted as a real, disclosed gap rather than
  fixed: adding a synthetic untranslated post would either pollute
  production content or need mocking `astro:content` disproportionate to
  the risk. `tests/site-consistency.spec.js`'s pre-existing "never a
  shorter blog in one language" test provides the same protection at the
  index-page level and would catch a regression here too.
- **MINOR** — README overclaimed the RSS discovery `<link>` was "on every
  page"; it's Astro-rendered pages only (the plain `site/*.html`
  marketing pages don't run through `BaseLayout`). **Fixed**: reworded.
- **MINOR** — 12 of the (then-)36 sitemap URLs (`/download`, `/store`,
  `/language` × 4 locales) pointed at marketing pages whose canonical tag
  disagreed with the URL being submitted (see above), and
  `site/language.html` is explicitly `noindex`. **Fixed**: added
  `id="canonical"` to `download.html`/`store.html` so the existing
  per-locale rewrite applies to them like it already does for
  `index.html`/`start.html`; excluded `noindex` pages from the sitemap
  generically (content-based, not a hardcoded name) — sitemap is now 32
  entries, not 36.
- **MINOR** — `tests/seo.spec.js` hard-coded today's 2 post slugs and a
  literal item count; would turn CI red on a pure content commit (a third
  post published through the CMS). **Fixed**: both derived from the real
  `src/content/blog/en-gb/*.mdx` directory at test time instead.
- **MINOR** — JSON-LD's `publisher.logo` pointed at `site/logo.svg`;
  Google's structured-data `ImageObject` requirements for a publisher
  logo are raster (jpg/png/gif), so this produced a Rich Results
  warning without satisfying the field. **Fixed**: dropped `logo` (not
  required for `Organization`/`BlogPosting` validity) rather than point
  it at a type that fails the check; a raster brand asset can add it back
  later.
- **MINOR** — `[slug].astro`'s `getStaticPaths` still carried its own
  copy of the locale/fallback resolution instead of using the new shared
  helper, reintroducing exactly the drift risk the helper exists to
  remove (today they agree; a future edit to one could silently diverge
  from the other, advertising sitemap URLs that 404). **Fixed**: now
  built from `getAllLocalizedPosts()` directly.
- **NIT** — JSON-LD used `set:html={JSON.stringify(...)}` unescaped; a
  post title/excerpt containing `</script>` (content passes through a
  translation model, not strictly developer-controlled) would break out
  of the script tag. **Fixed**: `.replace(/</g, '\\u003c')`.
- **NIT** — `marketingPaths()`'s route filter had no guard against a
  future wildcard (`/foo/*`) rewrite entry, which would emit a literal
  `*` into a `<loc>`. Latent only (no such entry exists today) — **fixed
  anyway** alongside the noindex filter since both touched the same
  function.
- **Accepted, not fixed**: `@astrojs/rss` has no per-channel `<link>`
  override, so each locale's feed channel `<link>` points at the site
  root rather than that locale's `/blog` page. Confirmed no AC requires
  it and the alternative (raw-XML string surgery on the package's
  generated output) is a worse defect than the one it would fix — feed
  readers key on the per-item `<link>`s, which are correct and
  per-locale.
- **Explicitly cleared**: the `tests/site-consistency.spec.js` selector
  tightened from `link[rel="alternate"]` to `link[rel="alternate"][hreflang]`
  (to stop colliding with the new RSS `<link>`, which shares the same
  `rel`) still asserts the exact same locale set and hrefs — not
  weakened. No real client/shop name or secret-shaped literal anywhere in
  the diff. `package-lock.json`'s churn beyond the one new dependency
  (~20 packages removed, mostly `lightningcss` platform binaries and
  vite dev-only transitives) is benign regeneration — reproduced
  byte-for-byte via `npm install --package-lock-only` under the CI-pinned
  Node/npm versions, `npm audit` clean, and every unfamiliar transitive
  package traced to a legitimate maintainer (the `fast-xml-parser`
  v5 refactor, and `piccolore` from Astro's own maintainer).

## Verified beyond automated tests

- **TDD, both directions, done twice**: once during Dev (all 10
  `seo.spec.js` tests written and confirmed failing pre-implementation
  with real errors — `toContain` mismatches on the sitemap tests,
  `locator` timeouts on the JSON-LD tests), and again by the independent
  reviewer against the finished diff (removed `sitemap.xml.ts`, deleted
  the JSON-LD script line — same real failures both times, restored,
  confirmed green again).
- **Sitemap/config sync re-verified adversarially, twice**: (1) inserted
  a new route into `staticwebapp.config.json` and confirmed the sitemap
  picked it up with zero code changes; (2) swapped the implementation for
  a hardcoded path list and confirmed the (now-fixed) test catches it —
  see "Independent review" above for the exact numbers.
- **Full gate, after every round of fixes**: `npm run build`,
  `node scripts/check-i18n-keys.js`, `bash scripts/check-brand-assets.sh`,
  `node scripts/check-swa-config.js`, the `site/` → `dist/`
  byte-for-byte pass-through check, and the full `npx playwright test`
  suite (62/62, not just the 10 new tests) — all green on the final
  state.
- **Built output inspected directly**, not just asserted on: `sitemap.xml`
  (32 `<loc>` entries, all absolute on `https://www.universaltill.com`,
  correct trailing-slash agreement with each page's own canonical),
  all 4 `rss.xml` files (valid XML via both the browser's `DOMParser`
  and an independent Python `xml.dom.minidom` parse; fa-ir's feed
  content is genuinely in Persian, confirming the fallback helper feeds
  the same content the blog index shows), and the JSON-LD block on a
  built post page.
- **No visible-surface changes** — JSON-LD, sitemap.xml and RSS are
  invisible metadata/endpoints; the one visible-adjacent change (the RSS
  `<link>` in `<head>`) renders nothing. No screenshot check applies;
  none was skipped that should have run.

## Safe-to-merge verdict

Yes. Full gate green, independent review's findings all fixed or
explicitly accepted with reasoning above, TDD re-verified twice.

## Explicitly deferred

- English-fallback path in `blogPosts.ts` has no direct fixture coverage
  (see MINOR above) — real, accepted, not a merge blocker.
- `publisher.logo` on JSON-LD can be restored once a raster (png/jpg)
  brand asset exists.
- Per-channel RSS `<link>` pointing at the locale's `/blog` page instead
  of the site root — blocked on `@astrojs/rss`'s API, not worth raw-XML
  surgery for.
