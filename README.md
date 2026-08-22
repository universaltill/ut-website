# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — the plain-HTML marketing site (en/tr/zh/fa/de). Deliberately **not**
  rewritten into Astro components: it is proven and multilingual, and
  re-transcribing ~500 translated strings by hand would risk silently
  introducing translation bugs. `astro.config.mjs` sets `publicDir: 'site'`,
  so Astro copies this tree into `dist/` **byte-for-byte unchanged**. Edit
  these files exactly as before.
- Astro builds only genuinely *new* surface on top of that: the blog
  (`src/content/blog/`, MDX content collections) and `/plugins`. See
  `docs/astro-migration.md`.
- **SEO plumbing (ut-docs#482):** every blog post carries a JSON-LD
  `BlogPosting` block; `sitemap.xml` covers the blog, `/plugins` and the
  `site/` marketing pages in every locale (built from
  `site/staticwebapp.config.json`'s route table, not a hand-kept copy of
  it); each locale gets its own RSS feed at `/{locale}/blog/rss.xml`,
  discoverable via a `<link rel="alternate" type="application/rss+xml">`
  on every Astro-rendered page (blog index/posts, `/plugins` — the plain
  `site/*.html` marketing pages don't carry it, same as they don't carry
  BaseLayout's other `<head>` mechanics). `src/lib/blogPosts.ts` is the
  one place "which posts
  exist, in which locale" is decided — the blog index, the sitemap and
  every RSS feed all read from it.
- **The Decap CMS admin does NOT live here.** It's served from the homelab
  cluster at `admin.universaltill.com`, gated by Zitadel via oauth2-proxy
  (`taskrunnertech/homelab-k8s`'s `kubernetes/apps/ut-admin/`) — this SWA
  intentionally has no `/admin` route and no `auth` block; `site/admin/*` and
  `/admin` are explicitly excluded from `navigationFallback` so a request to
  either 404s cleanly instead of silently serving the homepage
  (ut-docs#461/#471). Decap's GitHub OAuth relay (`api/auth` + `api/callback`)
  moved there too and is **gone from this repo** — it has to be same-origin
  with the CMS, because Decap's popup `postMessage` is origin-pinned
  (ut-docs#468). `scripts/check-swa-config.js` (CI) fails if any of it returns.
- **There is a build step now**: `npm ci && npm run build` → `dist/`, which is
  what gets deployed. `dist/`, `.astro/` and `node_modules/` are git-ignored.
  `package.json`'s `devDependencies` also carry Playwright (`tests/`,
  test-only, never part of what ships).
- **Every page has a URL per locale, English included**: `/en-gb/…`,
  `/tr-tr/…`, `/zh-cn/…`, `/fa-ir/…`, `/de-de/…`. Region-tagged because VAT, receipt law
  and payment rails differ by country, not by language — and prefixed even for
  the default, because an unprefixed URL states no language, so "switch back to
  English" would land on a URL that still renders Turkish from the stored
  preference. `site/i18n.js` derives the locale (and RTL) from the first path
  segment, path beating any stored choice; the Astro pages build one file per
  locale; `staticwebapp.config.json` maps the prefixed pretty-URLs and 301s
  every older URL (`/`, `/blog`, `/download`, `/tr`, …). The globe carries the
  current page (`/language?from=…`) so choosing a language returns you where
  you were, not to the homepage.
- **Posts are translated, not just the chrome.** English posts live in
  `src/content/blog/en-gb/` and are the only ones written by hand (that is the
  folder the CMS files into). `node scripts/translate-posts.js` fills in
  `tr-tr/`, `zh-cn/`, `fa-ir/` and `de-de/` using the **self-hosted** model on the
  homelab (Ollama on the NAS, LAN-only — never a paid AI API), and the output is
  committed like any other content, so the site depends on files in git rather
  than on a model being up. Translations carry `machineTranslated: true` and
  say so on the page, with a link to the English original. A missing
  translation is not an error: that locale falls back to English and tells the
  reader. The script rejects output that drops a section, rewrites a link,
  translates the product name or comes back in the wrong script, and retries.
- **There is no `navigationFallback`.** It answered every unknown path with the
  homepage at HTTP 200 — which is why `/blog` looked live for weeks before it
  existed, and why `/admin` looked like it was still served. Unknown paths 404.
  `scripts/check-swa-config.js` fails if it returns without excluding `/admin`.
- `scripts/check-i18n-keys.js` (run on every push/PR via `.github/workflows/ci.yml`)
  guards `site/i18n.js`: every `data-i18n`/`data-i18n-html` key used across
  `site/*.html` must exist in all five locale dicts (en/tr/zh/fa/de), and the
  dicts must share the same key set — a missing key otherwise fails silently
  (the untranslated string just keeps its English source text in every
  locale).
- `scripts/guard-compliance-claims.sh` + `scripts/guard-compliance-claims_test.sh`
  (ut-docs#702, the `check-compliance-claims` CI job) enforce the
  product-owner-approved fiscal-compliance wording denylist (ut-docs#667) —
  no "GoBD-compliant", "revisionssicher"/"audit-proof", "certified by the
  Finanzamt", or claims of filing a merchant's §146a notification on their
  behalf, anywhere this site's copy can appear: `site/i18n.js`,
  `src/content/blog/**/*.mdx`, `site/*.html`, `src/**/*.astro`. Same
  denylist and `compliance-claim:allow` escape-hatch convention as
  `universal-till`'s own `scripts/ci/guard-compliance-claims.sh` — kept in
  sync by hand across the two repos.
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

## Custom domain

`universaltill.com` is registered at GoDaddy. To go live on the real domain:
point the domain's name servers at the Azure DNS zone (terraform output
`dns_zone_name_servers`), then apply the website terraform with
`-var enable_custom_domain=true`.
