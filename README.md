# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — the plain-HTML marketing site (en/tr/zh/fa). Deliberately **not**
  rewritten into Astro components: it is proven and multilingual, and
  re-transcribing ~500 translated strings by hand would risk silently
  introducing translation bugs. `astro.config.mjs` sets `publicDir: 'site'`,
  so Astro copies this tree into `dist/` **byte-for-byte unchanged**. Edit
  these files exactly as before.
- Astro builds only genuinely *new* surface on top of that: the blog
  (`src/content/blog/`, MDX content collections), `/plugins`, and the Decap
  CMS admin at `site/admin/` behind a Zitadel OIDC gate (configured in
  `site/staticwebapp.config.json`, with `api/auth` + `api/callback` handling
  Decap's GitHub OAuth). See `docs/astro-migration.md`.
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
  uploads `dist/` (plus `api/` as the SWA managed functions).
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
