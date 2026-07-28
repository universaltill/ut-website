'use strict';

const COOKIE_NAME = 'decap_cms_github_oauth_state';

function html(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Universal Till CMS Auth</title></head><body>${body}</body></html>`;
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

      const key = part.slice(0, index);
      const value = part.slice(index + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
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

module.exports = async function (context, req) {
  const siteOrigin = getSiteOrigin(req);

  try {
    const code = req.query.code;
    const state = req.query.state;
    const error = req.query.error;
    const errorDescription = req.query.error_description;

    if (error) {
      throw new Error(errorDescription || error);
    }

    if (!code || !state) {
      throw new Error('Missing OAuth code or state.');
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const expectedState = cookies[COOKIE_NAME];

    if (!expectedState || expectedState !== state) {
      throw new Error('OAuth state verification failed.');
    }

    const { clientId, clientSecret } = githubClientConfig();
    const redirectUri = `${siteOrigin}/api/callback`;
    const accessToken = await exchangeCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    const payload = JSON.stringify({ token: accessToken });

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`,
      },
      body: html(`
        <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
          <p>GitHub login completed. You can close this window.</p>
        </main>
        <script>
          (function () {
            const targetOrigin = ${JSON.stringify(siteOrigin)};
            const message = 'authorization:github:success:' + ${JSON.stringify(payload)};
            if (window.opener) {
              window.opener.postMessage(message, targetOrigin);
              window.close();
            }
          })();
        </script>
      `),
    };
  } catch (err) {
    const errorPayload = JSON.stringify({ message: err.message });

    context.log.error(err);
    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`,
      },
      body: html(`
        <main style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto;">
          <h1>GitHub login failed</h1>
          <p>${err.message}</p>
        </main>
        <script>
          (function () {
            const targetOrigin = ${JSON.stringify(siteOrigin)};
            const message = 'authorization:github:error:' + ${JSON.stringify(errorPayload)};
            if (window.opener) {
              window.opener.postMessage(message, targetOrigin);
            }
          })();
        </script>
      `),
    };
  }
};
