# Astro + Decap CMS migration (2026-07-28, overnight)

**Update (2026-08-08, ut-docs#461/#468/#471):** the plan below to gate
`/admin` on this Static Web App via Azure's native Zitadel OIDC provider was
**not viable** — that feature requires the SWA Standard plan, and this site
runs on Free. The product owner chose instead to serve the Decap admin from
the homelab cluster at `admin.universaltill.com`, gated by Zitadel via
oauth2-proxy (`taskrunnertech/homelab-k8s`'s `kubernetes/apps/ut-admin/`).
This repo's `site/admin/`, `staticwebapp.config.json`'s `auth` block and
`/admin` routes have been removed accordingly (ut-docs#471) — `/admin` and
`/admin/*` stay in `navigationFallback.exclude` so they correctly 404 rather
than silently falling back to the homepage. `api/auth` + `api/callback` have
been **deleted from this repo** — they were ported same-origin into the
ut-admin pod (ut-docs#468), hardening and tests included, because a
cross-origin `postMessage` between the two hosts is dropped by the browser by
design, so the OAuth relay could not stay split across both. The rest of this
document (the blog,
the marketing-pages-stay-plain-HTML decision) is still accurate.

## What changed

- Astro scaffolded (`package.json`, `astro.config.mjs`, Tailwind v4 via
  `@tailwindcss/vite`, MDX).
- **`site/` is Astro's `publicDir`, not rewritten.** Every existing page
  (`index.html`, `start.html`, `store.html`, `download.html`,
  `language.html`), `styles.css`, `i18n.js`, images, and
  `staticwebapp.config.json` are copied into the build output
  byte-for-byte unchanged — verified with a diff-free build + local
  `curl` spot-check of each page.
- New: a `blog` content collection (`src/content/blog/*.mdx`) + listing
  (`/blog`) and post (`/blog/[slug]`) pages, styled to match the
  existing site via `site/styles.css` (not a second design system).
- New: Decap CMS admin at `/admin` (`site/admin/index.html`), GitHub
  backend. Auth: `api/auth` + `api/callback` Azure Functions, copied
  from the proven `taskrunner/website` implementation (same "hard-won"
  gotchas apply — no `main` field in `api/package.json`, v3 Functions
  programming model, `host.json` stays `{"version": "2.0"}`).
- New: `/admin` is gated by Zitadel via Azure Static Web Apps' **native**
  custom OpenID Connect provider (`staticwebapp.config.json`'s
  `auth.identityProviders.customOpenIdConnectProviders`) — not
  hand-rolled Function/session code. GitHub OAuth still handles the
  actual git commits; Zitadel is the login gate in front of the page.

## Why the marketing pages were NOT rewritten into Astro components

`site/*.html` is multilingual (en/tr/zh/fa) via `i18n.js`'s
`data-i18n` swap — roughly 500 translated strings per language,
including RTL Farsi. Re-transcribing that into Astro
components/content-collections risks silently introducing a
translation bug in a language I can't proofread, with no way to
visually verify before it's live. The pass-through approach (Astro as
just the build wrapper, `publicDir: 'site'`) ships zero risk to that
content while still adding real new capability (blog, CMS).

**This is a deliberate, deferred decision, not an oversight.** If/when
you want the marketing pages to use Astro's own i18n routing (real
per-locale static HTML at build time — better SEO than the current
client-side text-swap, which serves English to any crawler that
doesn't execute JS) that's a good next step, but it's a real content
migration project of its own and should happen with your review of
each language, not overnight.

## What's needed before this goes live

1. **GitHub OAuth App** — Settings → Developer settings → OAuth Apps,
   callback `https://www.universaltill.com/api/callback`. No API for
   this, has to be clicked.
2. **Apply `ut-infra` PRs #10 and #11** (`terraform apply` with
   `TF_VAR_github_oauth_client_id`/`_secret` sourced from the new
   GitHub OAuth App, and the Zitadel vars sourced from Key Vault
   `website-zitadel-client-id`/`website-zitadel-client-secret` — those
   two already exist, the Zitadel app is already provisioned).
3. **Merge this PR**, which changes the deploy pipeline from
   `skip_app_build: true` (raw static upload) to an actual
   `npm run build` step + `api_location: "api"`. First deploy after
   merging is the one to watch closely.
4. Log into `/admin` once as yourself via the Zitadel gate to confirm
   the OIDC round-trip works, then authorize Decap's GitHub connection
   once to confirm commits land correctly.

## What I verified tonight (no browser available)

- `npm run build` succeeds, `dist/` contains all existing pages
  unchanged + the new `/blog/*` + `/admin` pages.
- `node --check` on both Azure Functions — no syntax errors.
- `staticwebapp.config.json` is valid JSON, `/admin/*` routes carry
  `allowedRoles: ["authenticated"]`, the Zitadel provider block is
  present in the built output.
- Served `dist/` locally, `curl`-verified index/blog listing/blog
  post/language page content.

**Not verified — needs your eyes:** actual visual appearance of the
blog pages, the real OAuth/OIDC round-trips end-to-end (both need real
browser sessions + the manual credential steps above), mobile
responsiveness of the new blog templates.
