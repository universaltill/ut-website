# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — the plain-HTML marketing site (en/tr/zh/fa). Deliberately **not**
  rewritten into Astro components: it is proven and multilingual, and
  re-transcribing ~500 translated strings by hand would risk silently
  introducing translation bugs. `astro.config.mjs` sets `publicDir: 'site'`,
  so Astro copies this tree into `dist/` **byte-for-byte unchanged**. Edit
  these files exactly as before.
- Astro builds only genuinely *new* surface on top of that: the blog
  (`src/content/blog/`, MDX content collections) and `/plugins`. See
  `docs/astro-migration.md`.
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
- `scripts/check-i18n-keys.js` (run on every push/PR via `.github/workflows/ci.yml`)
  guards `site/i18n.js`: every `data-i18n`/`data-i18n-html` key used across
  `site/*.html` must exist in all four locale dicts (en/tr/zh/fa), and the
  dicts must share the same key set — a missing key otherwise fails silently
  (the untranslated string just keeps its English source text in every
  locale).
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
