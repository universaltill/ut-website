'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'decap_cms_github_oauth_state';
const COOKIE_MAX_AGE_SECONDS = 600;

function html(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Universal Till CMS Auth</title></head><body>${body}</body></html>`;
}

// Never interpolate a value into the HTML above without this — see the
// matching note in api/callback/index.js.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON.stringify does not escape "<", so its output can close the enclosing
// <script> element. Use this for anything interpolated into script context.
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function getSiteOrigin(req) {
  // Inside SWA managed functions, x-forwarded-host is the internal
  // azurewebsites.net hostname, so the public origin must be configured.
  if (process.env.SITE_ORIGIN) {
    return process.env.SITE_ORIGIN.replace(/\/$/, '');
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function githubClientConfig() {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET.');
  }

  return { clientId, clientSecret };
}

module.exports = async function (context, req) {
  try {
    const provider = req.query.provider;

    if (provider !== 'github') {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html('<main><h1>Unsupported provider</h1><p>Only GitHub is supported.</p></main>'),
      };
      return;
    }

    const { clientId } = githubClientConfig();
    const siteOrigin = getSiteOrigin(req);
    const callbackUrl = `${siteOrigin}/api/callback`;
    const state = crypto.randomBytes(24).toString('hex');
    // Hard-coded, NOT taken from req.query. Two reasons:
    //   1. universaltill/ut-website is a public repo, so public_repo is
    //      sufficient. "repo" would grant read/write to every PRIVATE repo
    //      the editor can reach — universal-till, ut-infra, ut-cloud,
    //      ut-docs. A token minted to edit a blog post must not be able to
    //      rewrite Terraform.
    //   2. This endpoint is anonymous, so an attacker-supplied ?scope=
    //      turned our OAuth app into a consent-phishing relay (e.g.
    //      scope=repo,admin:org,delete_repo on a page branded as ours).
    const scope = 'public_repo';
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizeUrl.searchParams.set('scope', scope);
    authorizeUrl.searchParams.set('state', state);

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=${encodeURIComponent(state)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax; Secure`,
      },
      body: html(`
        <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
          <p>Preparing GitHub login…</p>
        </main>
        <script>
          (function () {
            const provider = 'github';
            const targetOrigin = ${jsonForScript(siteOrigin)};
            const authorizeUrl = ${jsonForScript(authorizeUrl.toString())};
            const handshake = 'authorizing:' + provider;

            function handleMessage(event) {
              if (event.origin !== targetOrigin) return;
              if (event.data !== handshake) return;
              window.removeEventListener('message', handleMessage);
              window.location.replace(authorizeUrl);
            }

            window.addEventListener('message', handleMessage);
            if (window.opener) {
              window.opener.postMessage(handshake, targetOrigin);
            }
          })();
        </script>
      `),
    };
  } catch (error) {
    context.log.error(error);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html(`<main><h1>CMS auth error</h1><p>${escapeHtml(error.message)}</p></main>`),
    };
  }
};
