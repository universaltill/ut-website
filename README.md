# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — static site, no build step.
- `scripts/check-i18n-keys.js` (run on every push/PR via `.github/workflows/ci.yml`)
  guards `site/i18n.js`: every `data-i18n`/`data-i18n-html` key used across
  `site/*.html` must exist in all four locale dicts (en/tr/zh/fa), and the
  dicts must share the same key set — a missing key otherwise fails silently
  (the untranslated string just keeps its English source text in every
  locale).
- Deploys automatically to an Azure Static Web App (free tier) on push to
  `main` via `.github/workflows/deploy.yml`.
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
