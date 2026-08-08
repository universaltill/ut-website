#!/usr/bin/env node
// Guards site/staticwebapp.config.json against the admin/CMS config creeping
// back into the public marketing site.
//
// The CMS admin does NOT live here any more — it runs on the homelab cluster at
// https://admin.universaltill.com, behind oauth2-proxy/Zitadel, with its own
// GitHub OAuth relay (homelab-k8s: kubernetes/apps/ut-admin/). Two things this
// file used to declare are worse than useless now:
//
//   * `auth.identityProviders.customOpenIdConnectProviders.zitadel` plus
//     `/admin` routes with allowedRoles — a gate that READS as protection and
//     enforces nothing, because Static Web Apps Free cannot enforce a custom
//     OIDC provider at all (that is a Standard-tier feature, ~$9/mo). A lock
//     painted on a door is worse than an open door: someone stops checking.
//   * a `responseOverrides.401` redirect into
//     `/.auth/login/zitadel?post_login_redirect_uri=/admin` — that redirect URI
//     has been deleted from the Zitadel application, so it is a redirect into
//     nothing.
//
// See ut-docs#471 (this cleanup) and ut-docs#468 (where the relay went).
// ESM, not CommonJS: package.json declares "type": "module" (required by the
// Astro build), so `require`/`__dirname` are not defined here — same reason
// and same treatment as scripts/check-i18n-keys.js.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, 'site', 'staticwebapp.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const problems = [];

if (config.auth) {
  problems.push(
    'staticwebapp.config.json has an `auth` block. SWA Free cannot enforce a ' +
      'custom OIDC provider, so this is a gate that does nothing. The real gate ' +
      'is oauth2-proxy in the ut-admin namespace.',
  );
}

if (config.responseOverrides) {
  problems.push(
    'staticwebapp.config.json has `responseOverrides`. The only one this site ' +
      'ever had redirected 401s into a Zitadel login path that no longer exists.',
  );
}

for (const route of config.routes || []) {
  if (route.allowedRoles) {
    problems.push(`route ${route.route} carries allowedRoles — nothing on this site is gated.`);
  }
  if (String(route.route).startsWith('/admin')) {
    problems.push(`route ${route.route} — the admin lives at admin.universaltill.com, not here.`);
  }
}

// There must be no navigationFallback at all. It answered EVERY unknown path
// with the homepage at HTTP 200, which is how this project repeatedly
// convinced itself a page existed when it did not — /blog looked live for
// weeks, and /admin looked like it was still being served. Every real URL now
// has an explicit route or a real file, so an unknown path should 404 and say
// so. If it ever comes back, /admin must be excluded from it.
const fallback = config.navigationFallback;
if (fallback && fallback.rewrite) {
  const excluded = fallback.exclude || [];
  const missing = ['/admin', '/admin/*'].filter((r) => !excluded.includes(r));
  if (missing.length) {
    problems.push(
      `navigationFallback is back and does not exclude ${missing.join(', ')} — ` +
        'those paths would answer 200 with the homepage instead of a clean 404.',
    );
  }
}

// One relay, not two that drift. The Decap<->GitHub OAuth functions moved into
// the ut-admin pod (they had to: postMessage is origin-pinned, so a relay on
// this domain could never talk to a CMS on admin.universaltill.com).
if (fs.existsSync(path.join(root, 'api'))) {
  problems.push('api/ is back. The OAuth relay lives in homelab-k8s (ut-docs#468) — one copy only.');
}

if (fs.existsSync(path.join(root, 'site', 'admin'))) {
  problems.push(
    'site/admin/ is back. The Decap config lives in the ut-admin ConfigMap ' +
      '(homelab-k8s) — a second copy here silently drifts from the deployed one.',
  );
}

if (config.platform && config.platform.apiRuntime) {
  problems.push('platform.apiRuntime pins a Functions runtime, but this site ships no api/.');
}

if (problems.length) {
  console.error('staticwebapp.config.json check FAILED:\n');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('OK: no admin/CMS configuration on the public site');
