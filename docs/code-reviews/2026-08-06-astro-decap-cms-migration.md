# 2026-08-06 — Astro + Decap CMS + blog, Zitadel-gated admin (PR #4)

**Card:** universaltill/ut-docs#306 (stale-PR resolution)
**PR:** universaltill/ut-website#4 — branch `feat/astro-decap-cms-migration`
**Outcome: NOT merged.** Security findings fixed; merge deliberately gated
on a production prerequisite this cycle could not satisfy. See "Merge gate".

## Why this PR was picked up at all

It had been open since 2026-07-28 with no review record, one of four stale
till-side PRs collected in ut-docs#306. The card's own instruction was to
first re-check whether the work was still wanted, because a week of `main`
had moved underneath it.

The signals genuinely contradicted each other:

- **For:** a live Zitadel OIDC app named *"Website Admin (Decap CMS gate)"*
  exists in production — created 2026-07-27 and codified into Terraform on
  2026-07-30 (`ut-infra` `unitill-infra/zitadel/website.tf`) from the live
  app's exact attributes. Infrastructure had been provisioned specifically
  for this feature. The ecosystem `CLAUDE.md` also already described the
  website as Astro-based.
- **Against:** `main`'s `.gitignore` calls it *"the retired Astro setup"*.

That note turned out to be weak evidence: Astro was **never on `main`**
(`git log --diff-filter=ADM -- astro.config.mjs package.json src/` is
empty). The comment was added 2026-08-05 by an unrelated logo fix (#290)
describing untracked local build output, not a recorded decision.

Because the live infrastructure and the stated architecture pointed one way
and an incidental comment pointed the other, this was escalated as a
product decision rather than assumed. **Product owner, 2026-08-06: adopt
the Astro + Decap CMS direction.** That decision is about direction; the
merge gate below is a separate, engineering matter.

## Independent review

Performed by a different model (Opus) with no part in writing the code, on
the branch with current `main` already merged in. Verdict: **DO NOT MERGE**,
on two independent grounds (one BLOCKER security bug, one sequencing gate),
plus 8 MAJOR and 7 MINOR findings.

### Fixed in this branch

| Sev | Finding | Fix |
|---|---|---|
| **BLOCKER** | Reflected XSS in `api/callback/index.js`, two independent sinks: `?error_description=` interpolated raw into the error page's HTML, and `JSON.stringify` used in `<script>` context (it escapes neither `<` nor `>`, so `</script><script>…` broke out regardless). The endpoint is `authLevel: anonymous` and shares an origin with `/admin`, where Decap keeps a GitHub token in `localStorage` — so this was credential-stealing, reachable by anyone with a link. | Stopped reflecting the attacker-controlled param entirely (logged server-side, page shows a fixed string); added `escapeHtml()` for anything reaching markup and a `jsonForScript()` that escapes `< > U+2028 U+2029`. Applied to `api/auth`'s 500 page too. |
| **MAJOR** | OAuth scope was `req.query.scope \|\| 'repo'`. `repo` grants read/write to every **private** repo the editor can reach (`universal-till`, `ut-infra`, `ut-cloud`, `ut-docs`) — a token minted to edit a blog post could rewrite Terraform. Taken from the query string on an anonymous endpoint, it also made our OAuth app a consent-phishing relay (`?scope=repo,admin:org,delete_repo`). | Hard-coded to `public_repo` (`ut-website` is a public repo, so it suffices). `req.query.scope` ignored. |
| **MAJOR** | `deploy.yml` used `app_location: "/"` + `output_location: "dist"` with `skip_app_build: true` — an ambiguous combination. If `output_location` were ignored it would upload the repo **root**, including the `node_modules/` that `npm ci` had just created. This repo has already had a deploy rejected at the 250 MB free-tier cap (deploy 30313779077). | `app_location: "dist"`, `output_location` dropped — structurally identical to the proven pre-Astro config. |
| **MAJOR** | No `platform.apiRuntime` in `staticwebapp.config.json`, now required because `api_location: "api"` introduces managed functions. | Added `"platform": { "apiRuntime": "node:20" }`. |
| **MAJOR** | `/plugins` iterated a hard-coded `typeOrder`, so `ut-plugin-button-nosale` (canonical type `button`) was grouped and then **never rendered** — on a page whose own copy claims to list every plugin, with no build error. | Renders known types first, then any remaining type. Verified 13 of 13 plugins now render. |
| **MAJOR** | A failed manifest fetch `throw`s inside `astro build`, so one `raw.githubusercontent` hiccup or rate-limit would block **every** website deploy, including urgent download-page fixes. | Per-plugin `try/catch`: warn, omit that card, ship the site. |
| MINOR | Token-bearing responses had no cache headers. | `Cache-Control: no-store, private` + `Pragma: no-cache`. |

Also fixed, found by running the repo's own gates against the merged tree
rather than the branch alone: the new `package.json` declares
`"type": "module"`, which retroactively broke the CommonJS
`scripts/check-i18n-keys.js` (`ReferenceError: require is not defined`).
That guard is what stops a `data-i18n` key missing from a locale dict
silently falling back to English in **all** locales. Converted to ESM.

### Corrected during verification — one review finding did not hold

The review flagged `ut-plugin-faq`'s `branch: '001-multilingual-faq-page'`
as a feature-branch pin that would break the build when deleted. Checked
directly: that **is** the repo's default branch — it has no `main`
(`gh api repos/universaltill/ut-plugin-faq --jq .default_branch`, and
`raw.githubusercontent` returns 404 for `main`, 200 for that branch). Left
as-is with a comment recording the check; the non-fatal fetch above covers
the residual risk anyway.

### Accepted as follow-ups, not fixed here

- **New pages are English-only while the site is multilingual** (ut-docs#353).
  `BaseLayout` loads `/i18n.js`, which flips `document.dir` from
  `localStorage`, so a Farsi visitor reaching `/blog` gets `dir="rtl"`
  applied to entirely English content. Conflicts with the standing
  `multilingual-everything` rule.
- **Decap CMS loaded from unpkg on a floating `^3.0.0` range with no SRI**
  (ut-docs#354), on the page that holds a repo-write token.
- Remaining MINORs (`local_backend: true` shipped, Decap committing
  straight to `main` rather than `editorial_workflow`, no explicit
  `format`, `/plugins` missing from `navigationFallback.exclude`, blog and
  plugins unreachable from the main site nav, `coverImage` authored but
  never rendered) are captured in ut-docs#353 / ut-docs#354.

### Explicitly checked and clean

No hardcoded secrets (both functions read `process.env`; the client secret
is only ever sent in the POST body to GitHub, never rendered or logged).
CSRF `state` is textbook — 192 bits from `crypto.randomBytes`, `HttpOnly`
`SameSite=Lax` `Secure` cookie, 600 s max-age, strictly compared, cleared
on both paths. No open redirect (`post_login_redirect_uri` is a fixed
relative `/admin`). `postMessage` uses an explicit `targetOrigin`, never
`'*'`, with an `event.origin` check on receive. The Zitadel gate genuinely
covers `/admin` and `/admin/*` and fails **closed**. No paid-AI-API
violation. No real client/shop name used as demo data.

## Verification performed

- `npm ci && npm run build` — clean.
- **Every file under `site/` is present in `dist/` byte-for-byte**, including
  `main`'s recent logo/i18n/download fixes. This is the entire safety
  argument for adding a build step beneath the proven multilingual site, so
  it is now a CI job rather than a one-off check.
- `node --test api/auth.test.js` — 5/5 pass. **Confirmed not false-passing:**
  run against the pre-fix commit `c2d89cc`, 3 of the 5 fail (reflection,
  cache header, scope); the other 2 pin behaviour that was already correct.
- `scripts/check-i18n-keys.js` — OK (4 locales, 167 keys, 5 pages).
  **Confirmed it still catches regressions** after the ESM conversion:
  injecting `data-i18n="zz.bogus.key.probe"` makes it exit 1 naming the key
  for all four locales.
- New `build` CI job's pass-through assertion **negative-tested**: removing
  one file from `dist/` makes it exit 1 naming that file.
- `/plugins` output inspected: 13 of 13 plugin cards, 6 type headings
  including the previously-dropped `Buttons`.

## Merge gate — why this is NOT merged

`site/staticwebapp.config.json` declares a custom Zitadel OIDC provider
referencing SWA app settings (`ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET`,
`GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, and `SITE_ORIGIN`)
that **do not exist in production yet**. The gate itself fails closed, which
is fine — but if Azure rejects the whole config file because the provider
cannot be resolved, the site loses `routes` and `navigationFallback`
entirely. `site/i18n.js` encodes locale in the path (`/tr`, `/zh`, `/fa`)
and only works because of that fallback, so the downside is a full-site
outage across three of four launch locales. That risk cannot be verified
from here, which is precisely why it must not be merged blind.

`ut-infra#10` — the Terraform that supplies those app settings — **was
merged this cycle**, but merging it does not apply it. The apply is blocked:
`plan (unitill-infra)` fails on an orphaned Azure blob lease
(`409 There is already a lease present`, `terraformlockid` empty),
reproducible on 2026-08-03 and again 2026-08-06. Tracked as **ut-docs#350**.

`SITE_ORIGIN` is additionally undocumented as a prerequisite in
`docs/astro-migration.md` — without it, `redirect_uri` resolves to the
internal `azurewebsites.net` hostname and login silently hangs.

**To merge:** clear ut-docs#350 → apply the ut-infra website workspace with
all five settings → verify with `az staticwebapp appsettings list` → merge
and watch the first deploy. Tracked as **ut-docs#355**.
