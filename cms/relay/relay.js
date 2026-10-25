'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const COOKIE_NAME = 'decap_cms_github_oauth_state';
const COOKIE_MAX_AGE_SECONDS = 600;

// Fixed, not derived from the request. Deriving it from Host/X-Forwarded-Host
// would let a request with a forged Host header choose the origin this page
// postMessages a GitHub token to.
const SITE_ORIGIN = (process.env.SITE_ORIGIN || 'https://cms.universaltill.com').replace(/\/$/, '');

const SECRETS_DIR = process.env.SECRETS_DIR || '/mnt/secrets-store';
const CLIENT_ID_FILE = path.join(SECRETS_DIR, 'website-cms-github-client-id');
const CLIENT_SECRET_FILE = path.join(SECRETS_DIR, 'website-cms-github-client-secret');

const PORT = Number(process.env.PORT || 8081);

// The response that carries a live GitHub access token must never be cached,
// and neither must the one that hands out a CSRF state cookie.
const NO_STORE = {
  'Cache-Control': 'no-store, private',
  Pragma: 'no-cache',
};

function html(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Universal Till CMS Auth</title></head><body>${body}</body></html>`;
}

// Anything interpolated into the HTML below must go through this. These
// endpoints share an origin with the admin page, where Decap keeps a GitHub
// token in localStorage — an unescaped reflection here is a
// credential-stealing XSS, not a cosmetic bug.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON.stringify does NOT escape "<" or "/", so its output can close the
// enclosing <script> element ("</script><script>…"). Escape the characters
// that let a string break out of script context, plus the two Unicode line
// terminators that are literal newlines in JS source.
function jsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Read per request rather than at startup, for two reasons. The CSI driver
// rewrites these files in place on its rotation poll, so a value cached at
// boot would pin this pod to a rotated-away credential until someone
// remembered to restart it. And a missing/empty file degrades to a 500 on
// the login popup instead of a CrashLoopBackOff that would take the whole
// admin — gate and page included — down with it.
function readSecretFile(file) {
  let value;
  try {
    value = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ${path.basename(file)} from the secrets mount.`);
  }
  // `az keyvault secret set --file` stores a trailing newline; GitHub rejects
  // a client_secret with one, with an error that reads like a wrong secret.
  value = value.trim();
  if (!value) {
    throw new Error(`${path.basename(file)} is empty.`);
  }
  return value;
}

function githubClientConfig() {
  return {
    clientId: readSecretFile(CLIENT_ID_FILE),
    clientSecret: readSecretFile(CLIENT_SECRET_FILE),
  };
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index === -1) {
        return cookies;
      }
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function stateCookie(value) {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  return value === ''
    ? `${base}; Max-Age=0`
    : `${base}; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'universaltill-cms-auth',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const body = await response.json();

  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || 'GitHub token exchange failed.');
  }

  return body.access_token;
}

function handleAuth(query) {
  if (query.provider !== 'github') {
    return {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE },
      body: html('<main><h1>Unsupported provider</h1><p>Only GitHub is supported.</p></main>'),
    };
  }

  const { clientId } = githubClientConfig();
  const state = crypto.randomBytes(24).toString('hex');

  // Hard-coded, NOT taken from query. Two reasons:
  //   1. universaltill/ut-website is a public repo, so public_repo is
  //      sufficient. "repo" — which is exactly what Decap's own default
  //      config asks for, and what arrives in ?scope= on every real login —
  //      would grant read/write to every PRIVATE repo the editor can reach:
  //      universal-till, ut-infra, ut-cloud, ut-docs. A token minted to edit
  //      a blog post must not be able to rewrite Terraform.
  //   2. Honouring an attacker-supplied ?scope= would turn our OAuth app
  //      into a consent-phishing relay (scope=repo,admin:org,delete_repo on
  //      a GitHub consent screen branded as ours).
  const scope = 'public_repo';

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', `${SITE_ORIGIN}/api/callback`);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  return {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': stateCookie(encodeURIComponent(state)),
      ...NO_STORE,
    },
    body: html(`
      <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
        <p>Preparing GitHub login…</p>
      </main>
      <script>
        (function () {
          const provider = 'github';
          const targetOrigin = ${jsonForScript(SITE_ORIGIN)};
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
}

async function handleCallback(query, headers, deps) {
  const exchange = deps.exchangeCodeForToken || exchangeCodeForToken;
  const log = deps.log || console.error;

  try {
    if (query.error) {
      // Deliberately NOT echoed back to the browser: error_description is
      // attacker-controlled query input. Log it so the failure is
      // diagnosable, show the user a fixed string.
      log('GitHub OAuth returned an error', {
        error: query.error,
        errorDescription: query.error_description,
      });
      throw new Error('GitHub login was cancelled or failed.');
    }

    if (!query.code || !query.state) {
      throw new Error('Missing OAuth code or state.');
    }

    const expectedState = parseCookies(headers.cookie || '')[COOKIE_NAME];
    if (!expectedState || expectedState !== query.state) {
      throw new Error('OAuth state verification failed.');
    }

    const { clientId, clientSecret } = githubClientConfig();
    const accessToken = await exchange({
      code: query.code,
      clientId,
      clientSecret,
      redirectUri: `${SITE_ORIGIN}/api/callback`,
    });

    const payload = JSON.stringify({ token: accessToken });

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': stateCookie(''),
        ...NO_STORE,
      },
      body: html(`
        <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
          <p>GitHub login completed. You can close this window.</p>
        </main>
        <script>
          (function () {
            const targetOrigin = ${jsonForScript(SITE_ORIGIN)};
            const message = 'authorization:github:success:' + ${jsonForScript(payload)};
            if (window.opener) {
              window.opener.postMessage(message, targetOrigin);
              window.close();
            }
          })();
        </script>
      `),
    };
  } catch (err) {
    log(err);
    const errorPayload = JSON.stringify({ message: err.message });

    // 200, not 4xx: this page's job is to hand the error back to the opener
    // through postMessage so Decap stops waiting. A status code alone tells
    // the opener nothing — it cannot read a cross-window response.
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': stateCookie(''),
        ...NO_STORE,
      },
      body: html(`
        <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
          <h1>GitHub login failed</h1>
          <p>${escapeHtml(err.message)}</p>
        </main>
        <script>
          (function () {
            const targetOrigin = ${jsonForScript(SITE_ORIGIN)};
            const message = 'authorization:github:error:' + ${jsonForScript(errorPayload)};
            if (window.opener) {
              window.opener.postMessage(message, targetOrigin);
            }
          })();
        </script>
      `),
    };
  }
}

async function handle(req, deps = {}) {
  // Base only matters for parsing a relative URL; nothing downstream reads
  // the host off it.
  const url = new URL(req.url, SITE_ORIGIN);
  const query = Object.fromEntries(url.searchParams);

  if (req.method !== 'GET') {
    return {
      status: 405,
      headers: { 'Content-Type': 'text/html; charset=utf-8', Allow: 'GET', ...NO_STORE },
      body: html('<main><h1>Method not allowed</h1></main>'),
    };
  }

  switch (url.pathname) {
    case '/healthz':
      return { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'ok' };
    case '/api/auth':
      try {
        return handleAuth(query);
      } catch (err) {
        // Almost always "the secrets mount has no client id/secret yet".
        // Show it: the alternative is a popup that looks identical to a
        // GitHub outage. The message is fixed text from this file, never
        // request input, and still goes through escapeHtml.
        (deps.log || console.error)(err);
        return {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE },
          body: html(`<main><h1>CMS auth error</h1><p>${escapeHtml(err.message)}</p></main>`),
        };
      }
    case '/api/callback':
      return handleCallback(query, req.headers || {}, deps);
    default:
      // The path is never reflected into this body — an unescaped one would
      // be a stored-nowhere but perfectly good reflected XSS on this origin.
      return {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE },
        body: html('<main><h1>Not found</h1></main>'),
      };
  }
}

if (require.main === module) {
  const server = http.createServer((req, res) => {
    handle({ method: req.method, url: req.url, headers: req.headers })
      .then((result) => {
        res.writeHead(result.status, result.headers);
        res.end(result.body);
      })
      .catch((err) => {
        // Last-resort handler: everything above already catches, but an
        // uncaught throw here would otherwise leave the popup hanging with
        // no response at all.
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8', ...NO_STORE });
        res.end(html('<main><h1>CMS auth error</h1></main>'));
      });
  });

  // LOOPBACK ONLY, for the same reason nginx binds loopback in
  // cms/web/default.conf: pod IPs are directly routable across the homelab
  // k3s/flannel cluster (as replica IPs are inside an ACA VNet), and that
  // cluster runs Actions Runner Controller,
  // so a 0.0.0.0 bind would let CI job code from any PR curl an anonymous
  // token-minting endpoint. Traffic reaches here only via oauth2-proxy ->
  // nginx -> 127.0.0.1:8081, i.e. only after passing the Zitadel gate.
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`ut-cms oauth relay listening on 127.0.0.1:${PORT}, origin ${SITE_ORIGIN}`);
  });
}

module.exports = { handle, escapeHtml, jsonForScript, COOKIE_NAME, SITE_ORIGIN };
