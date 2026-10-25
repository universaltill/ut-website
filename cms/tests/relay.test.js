// Regression tests for the Decap CMS OAuth relay (cms/relay/relay.js).
//
// These exist because the relay MINTS GITHUB TOKENS. It shares an origin with
// the admin page, where Decap keeps that token in localStorage, so a
// reflection bug here is credential theft rather than a broken page — and
// because the scope it asks for is the only thing standing between "edit a
// blog post" and "write to every private repo the editor can reach".
//
// The source under test is cms/relay/relay.js itself — the exact file the
// ut-cms-relay image copies in (cms/relay/Dockerfile), never a duplicate.
//
// Run: node --test cms/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RELAY = path.join(__dirname, '..', 'relay', 'relay.js');

function relaySource() {
  const src = fs.readFileSync(RELAY, 'utf8');
  assert.ok(src.split('\n').length > 50, 'relay source is implausibly short');
  return src;
}

const secretsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-cms-secrets-'));
// A trailing newline on purpose: `az keyvault secret set --file` stores one,
// and an untrimmed client_secret fails the token exchange with an error that
// reads exactly like a wrong secret.
fs.writeFileSync(path.join(secretsDir, 'website-cms-github-client-id'), 'test-client-id\n');
fs.writeFileSync(path.join(secretsDir, 'website-cms-github-client-secret'), 'test-client-secret\n');

process.env.SECRETS_DIR = secretsDir;
process.env.SITE_ORIGIN = 'https://cms.universaltill.com';

const moduleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ut-cms-relay-'));
const modulePath = path.join(moduleDir, 'relay.js');
fs.writeFileSync(modulePath, relaySource());
const relay = require(modulePath);

const CMS_ORIGIN = 'https://cms.universaltill.com';

function collect() {
  const entries = [];
  const log = (...args) => entries.push(args);
  return { log, entries };
}

function get(url, { headers = {}, deps = {} } = {}) {
  return relay.handle({ method: 'GET', url, headers }, deps);
}

// A payload that breaks out of BOTH an HTML text context and a <script>
// string context, which are the two sinks these pages have.
const XSS = `<img src=x onerror=alert(1)></script><script>alert(document.domain)</script>`;

test('auth: the OAuth scope is fixed at public_repo and ignores ?scope=', async () => {
  // ?scope=repo is not a hypothetical attack — it is what Decap's own default
  // config sends on every real login (seen live: /api/auth?provider=github&
  // site_id=admin.universaltill.com&scope=repo, before the CMS moved to cms.).
  const res = await get('/api/auth?provider=github&scope=repo,admin:org,delete_repo,workflow');

  assert.ok(res.body.includes('scope=public_repo'), 'expected the hard-coded public_repo scope');
  assert.ok(!res.body.includes('admin%3Aorg'), 'caller-supplied scope leaked into the authorize URL');
  assert.ok(!res.body.includes('delete_repo'), 'caller-supplied scope leaked into the authorize URL');
  assert.ok(!/scope=repo[&"']/.test(res.body), 'caller-supplied scope leaked into the authorize URL');
});

test('auth: the client secret never reaches the browser, and the id is trimmed', async () => {
  const res = await get('/api/auth?provider=github');

  assert.ok(!res.body.includes('test-client-secret'), 'client secret leaked into the response body');
  assert.ok(
    res.body.includes('client_id=test-client-id&'),
    'client id should be sent trimmed — a stored trailing newline must not survive',
  );
  assert.ok(!res.body.includes('%0A'), 'an untrimmed secret file leaked a newline into the authorize URL');
});

test('auth: the popup talks to the ADMIN origin, not the marketing site', async () => {
  // The entire reason this relay exists (ut-docs#468): postMessage to a
  // mismatched target origin is dropped silently and the login hangs forever.
  const res = await get('/api/auth?provider=github');

  assert.ok(res.body.includes(`"${CMS_ORIGIN}"`), 'targetOrigin must be the admin origin');
  assert.ok(!res.body.includes('www.universaltill.com'), 'the marketing origin must not appear');
  assert.ok(
    res.body.includes(`redirect_uri=${encodeURIComponent(`${CMS_ORIGIN}/api/callback`)}`),
    'the OAuth redirect_uri must point back at this host',
  );
});

test('auth: the state cookie is HttpOnly, Secure and SameSite=Lax, and nothing is cached', async () => {
  const res = await get('/api/auth?provider=github');
  const cookie = res.headers['Set-Cookie'];

  assert.match(cookie, /^decap_cms_github_oauth_state=[0-9a-f]{48};/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(res.headers['Cache-Control'], /no-store/);
});

test('auth: an unknown provider is refused', async () => {
  const res = await get('/api/auth?provider=gitlab');
  assert.strictEqual(res.status, 400);
});

test('auth: a missing secrets mount degrades to an error page, not a crash', async () => {
  const previous = process.env.SECRETS_DIR;
  try {
    // The module read SECRETS_DIR at load time, so point the FILE at nothing by
    // moving the real one aside instead.
    fs.renameSync(
      path.join(secretsDir, 'website-cms-github-client-id'),
      path.join(secretsDir, 'moved-aside'),
    );

    const logs = collect();
    const res = await get('/api/auth?provider=github', { deps: { log: logs.log } });

    assert.strictEqual(res.status, 500);
    assert.ok(res.body.includes('website-cms-github-client-id'), 'the error should name the missing file');
    assert.ok(logs.entries.length > 0, 'the failure must be logged server-side');
  } finally {
    fs.renameSync(
      path.join(secretsDir, 'moved-aside'),
      path.join(secretsDir, 'website-cms-github-client-id'),
    );
    process.env.SECRETS_DIR = previous;
  }
});

test('callback: an attacker-supplied error_description is never reflected into the page', async () => {
  const logs = collect();
  const res = await get(
    `/api/callback?error=access_denied&error_description=${encodeURIComponent(XSS)}`,
    { deps: { log: logs.log } },
  );

  const body = res.body;
  assert.ok(!body.includes('<img src=x'), 'raw <img> tag was reflected into the HTML');
  assert.ok(!body.includes('onerror=alert'), 'raw event handler was reflected into the HTML');
  assert.ok(!body.includes('</script><script>'), 'attacker closed the script element');
  assert.ok(!body.includes('alert(document.domain)'), 'attacker script survived into the page');

  assert.ok(body.includes('GitHub login was cancelled or failed.'), 'expected the fixed error string');
  assert.ok(
    JSON.stringify(logs.entries).includes('access_denied'),
    'the real OAuth error should still be logged server-side',
  );
});

test('callback: an error message reaching the page is HTML-escaped', async () => {
  const res = await get('/api/callback', { deps: { log: () => {} } });

  assert.ok(res.body.includes('Missing OAuth code or state.'), 'expected the internal error text');
  assert.ok(!/<img|onerror=/.test(res.body), 'no raw markup should be present');
});

test('callback: a hostile message from the token exchange is escaped in BOTH sinks', async () => {
  // The one error path whose text is genuinely external: the exchange throws
  // with GitHub's own error_description. It reaches two sinks — the HTML body
  // and a JS string inside <script> — and needs different escaping in each.
  // (Every other message on this path is fixed text from relay.js, which is
  // why a test that only exercises those proves nothing about escaping.)
  const res = await get('/api/callback?code=abc&state=matching-state', {
    headers: { cookie: 'decap_cms_github_oauth_state=matching-state' },
    deps: {
      log: () => {},
      exchangeCodeForToken: async () => {
        throw new Error(XSS);
      },
    },
  });

  // Note what is NOT asserted: that the text "onerror=alert(1)" is absent. It
  // is present, escaped, and inert — asserting on the payload's words rather
  // than on its structure is how an escaping test ends up proving nothing.
  // What matters is that nothing of it is still MARKUP or CODE.
  assert.ok(!res.body.includes(XSS), 'the payload survived verbatim somewhere');
  assert.ok(!res.body.includes('<img'), 'raw <img> tag reached the HTML sink');
  assert.ok(res.body.includes('&lt;img'), 'expected the payload to be present but escaped');

  // The page has exactly one script element of its own. Any extra opening or
  // closing tag means the payload broke out of one of the two sinks.
  const opens = res.body.split('<script').length - 1;
  const closes = res.body.split('</script>').length - 1;
  assert.strictEqual(opens, 1, 'an extra <script> appeared — the payload broke out');
  assert.strictEqual(closes, 1, 'an extra </script> appeared — the payload broke out');

  assert.ok(res.body.includes('authorization:github:error:'), 'Decap still needs to be told it failed');
});

test('callback: a token-bearing response is never cacheable', async () => {
  const res = await get('/api/callback', { deps: { log: () => {} } });
  assert.match(res.headers['Cache-Control'], /no-store/);
});

test('callback: state mismatch is rejected before any token exchange (CSRF guard)', async () => {
  let exchanged = false;
  const res = await get('/api/callback?code=abc&state=attacker-state', {
    headers: { cookie: 'decap_cms_github_oauth_state=real-state' },
    deps: {
      log: () => {},
      exchangeCodeForToken: async () => {
        exchanged = true;
        return 'gho_should-never-be-minted';
      },
    },
  });

  assert.ok(res.body.includes('OAuth state verification failed.'));
  assert.strictEqual(exchanged, false, 'a mismatched state must not reach the token exchange');
});

test('callback: a missing state cookie is rejected (no cookie, no login)', async () => {
  const res = await get('/api/callback?code=abc&state=anything', { deps: { log: () => {} } });
  assert.ok(res.body.includes('OAuth state verification failed.'));
});

test('callback: the happy path hands the token to the admin origin, script-safely', async () => {
  // A token shaped to break out of the <script> string it is embedded in.
  const hostileToken = `gho_</script><script>alert(1)</script>`;
  const res = await get('/api/callback?code=abc&state=matching-state', {
    headers: { cookie: 'decap_cms_github_oauth_state=matching-state' },
    deps: {
      log: () => {},
      exchangeCodeForToken: async ({ code, clientId, clientSecret, redirectUri }) => {
        assert.strictEqual(code, 'abc');
        assert.strictEqual(clientId, 'test-client-id', 'client id must be trimmed');
        assert.strictEqual(clientSecret, 'test-client-secret', 'client secret must be trimmed');
        assert.strictEqual(redirectUri, `${CMS_ORIGIN}/api/callback`);
        return hostileToken;
      },
    },
  });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.includes('authorization:github:success:'), 'Decap expects this exact prefix');
  assert.ok(res.body.includes(`"${CMS_ORIGIN}"`), 'the token must be posted to the admin origin');
  assert.ok(!res.body.includes('</script><script>'), 'the token broke out of its script context');
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/, 'the state cookie must be cleared');
});

test('routing: a non-GET request is refused, and an unknown path does not reflect', async () => {
  const post = await relay.handle({ method: 'POST', url: '/api/auth?provider=github', headers: {} });
  assert.strictEqual(post.status, 405);

  const unknown = await get(`/${encodeURIComponent(XSS)}`);
  assert.strictEqual(unknown.status, 404);
  assert.ok(!unknown.body.includes('<img src=x'), 'the request path was reflected into the 404 page');
  assert.ok(!unknown.body.includes('alert('), 'the request path was reflected into the 404 page');
});

test('config: the origin is the CMS host even with SITE_ORIGIN unset', () => {
  // Every other test sets SITE_ORIGIN, so none of them can see a wrong
  // built-in default — and the default is what a pod with a mistyped env var
  // falls back to. Load a second copy with the variable removed.
  const previous = process.env.SITE_ORIGIN;
  delete process.env.SITE_ORIGIN;
  try {
    const secondPath = path.join(moduleDir, 'relay-default-origin.js');
    fs.writeFileSync(secondPath, relaySource());
    assert.strictEqual(require(secondPath).SITE_ORIGIN, CMS_ORIGIN);
  } finally {
    process.env.SITE_ORIGIN = previous;
  }
});

test('config: the image, the admin page and nginx agree about the origin', () => {
  // Three places have to name the same host or the login breaks in ways that
  // look like anything but a typo: the relay's SITE_ORIGIN (which is the
  // postMessage target AND the OAuth redirect_uri), Decap's base_url (where
  // the popup is opened from), and the callback registered on the GitHub
  // OAuth App. Only the first two are in this repo; the third is asserted by
  // the README instructions and the live check.
  const cmsDir = path.join(__dirname, '..');
  const dockerfile = fs.readFileSync(path.join(cmsDir, 'relay', 'Dockerfile'), 'utf8');
  const page = fs.readFileSync(path.join(cmsDir, 'web', 'index.html'), 'utf8');
  const conf = fs.readFileSync(path.join(cmsDir, 'web', 'default.conf'), 'utf8');

  assert.match(
    dockerfile,
    /^(ENV)?\s+SITE_ORIGIN=https:\/\/cms\.universaltill\.com \\$/m,
    'the relay image must carry the CMS origin explicitly',
  );
  assert.match(
    page,
    /"base_url": "https:\/\/cms\.universaltill\.com"/,
    "Decap's base_url must be this same origin",
  );
  assert.match(page, /"auth_endpoint": "api\/auth"/, 'Decap must call the relay path nginx proxies');
  assert.match(
    conf,
    /location \/api\/ \{\n\s+proxy_pass http:\/\/127\.0\.0\.1:8081;/,
    'nginx must proxy /api/ to the relay, or Decap gets a 404 page and hangs',
  );
});

test('health: the readiness path answers without touching secrets', async () => {
  // Every other test has the secret files in place, so a /healthz that read
  // them would still pass there. Make any secrets-dir read throw instead.
  const realRead = fs.readFileSync;
  const touched = [];
  fs.readFileSync = (file, ...rest) => {
    if (String(file).startsWith(secretsDir)) {
      touched.push(String(file));
      throw new Error('healthz read a secret file');
    }
    return realRead(file, ...rest);
  };
  try {
    const res = await get('/healthz');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body, 'ok');
  } finally {
    fs.readFileSync = realRead;
  }
  assert.deepStrictEqual(touched, [], '/healthz must not read the secrets mount');
});

test('listen: the relay binds 127.0.0.1 only — never all interfaces', () => {
  // The token-minting endpoint must be reachable only through nginx behind
  // oauth2-proxy. cms/scripts/smoke.sh proves it at run time; this catches
  // it before Docker is involved (parity with web.test.js's nginx check).
  const listens = relaySource().match(/\.listen\([^,)]*(,[^,)]*)?/g) || [];
  assert.deepStrictEqual(listens, [".listen(PORT, '127.0.0.1'"]);
});
