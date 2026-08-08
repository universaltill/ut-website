# universaltill.com

Public website for Universal Till — a product of **Task Runner Technology LTD**.

- `site/` — static site, no build step. `package.json` and the
  `devDependencies` it pulls in (Playwright) are test tooling only — they
  are never part of what ships to the Azure Static Web App.
- `scripts/check-i18n-keys.js` (run on every push/PR via `.github/workflows/ci.yml`)
  guards `site/i18n.js`: every `data-i18n`/`data-i18n-html` key used across
  `site/*.html` must exist in all four locale dicts (en/tr/zh/fa), and the
  dicts must share the same key set — a missing key otherwise fails silently
  (the untranslated string just keeps its English source text in every
  locale).
- `tests/mobile-nav.spec.js` is a Playwright regression suite covering the
  mobile hamburger nav and the language pill (ut-docs#458) — desktop vs.
  mobile layout, open/close via toggle/link-click/Escape/outside-click, and
  an RTL smoke check on `/fa`. Run it locally with
  `npm ci && npx playwright test` (installs Chromium automatically the
  first time via Playwright's own browser download, or reuses one you
  already have). It also runs on every push/PR via the `playwright` job in
  `.github/workflows/ci.yml`.
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
