// Regression tests for the Decap CMS OAuth endpoints.
//
// These exist because the endpoints are ANONYMOUS (function.json authLevel)
// and served from the same origin as /admin, where Decap keeps a GitHub
// access token in localStorage. An unescaped reflection here is a
// credential-stealing XSS on www.universaltill.com, not a cosmetic bug.
//
// Run: node --test api/
'use strict';

const test = require('node:test');
const assert = require('node:assert');

const authHandler = require('./auth/index.js');
const callbackHandler = require('./callback/index.js');

function fakeContext() {
  const logged = [];
  const log = (...args) => logged.push(args);
  log.error = (...args) => logged.push(args);
  return { log, logged, res: null };
}

const REQ_HEADERS = { host: 'www.universaltill.com', 'x-forwarded-proto': 'https' };

// A payload that breaks out of BOTH an HTML text context and a <script>
// string context, which are the two sinks the callback page has.
const XSS = `<img src=x onerror=alert(1)></script><script>alert(document.domain)</script>`;

test('callback: an attacker-supplied error_description is never reflected into the page', async () => {
  const ctx = fakeContext();
  await callbackHandler(ctx, {
    query: { error: 'access_denied', error_description: XSS },
    headers: REQ_HEADERS,
  });

  const body = ctx.res.body;

  // The literal attack string must not appear anywhere in the response.
  assert.ok(!body.includes('<img src=x'), 'raw <img> tag was reflected into the HTML');
  assert.ok(!body.includes('onerror=alert'), 'raw event handler was reflected into the HTML');
  assert.ok(
    !body.includes('</script><script>'),
    'attacker closed the script element — script-context escaping failed',
  );
  assert.ok(!body.includes('alert(document.domain)'), 'attacker script survived into the page');

  // It should show the fixed, non-reflective message instead.
  assert.ok(
    body.includes('GitHub login was cancelled or failed.'),
    'expected the fixed error string',
  );

  // And it must still be logged server-side so the failure is diagnosable.
  assert.ok(
    JSON.stringify(ctx.logged).includes('access_denied'),
    'the real OAuth error should still be logged server-side',
  );
});

test('callback: an error message reaching the page is HTML-escaped', async () => {
  const ctx = fakeContext();
  // No `error` param, missing code/state -> internal Error path.
  await callbackHandler(ctx, { query: {}, headers: REQ_HEADERS });

  const body = ctx.res.body;
  assert.ok(body.includes('Missing OAuth code or state.'), 'expected the internal error text');
  assert.ok(!/<img|onerror=/.test(body), 'no raw markup should be present');
});

test('callback: a token-bearing response is never cacheable', async () => {
  const ctx = fakeContext();
  await callbackHandler(ctx, { query: {}, headers: REQ_HEADERS });
  assert.match(ctx.res.headers['Cache-Control'], /no-store/);
});

test('callback: state mismatch is rejected (CSRF guard)', async () => {
  const ctx = fakeContext();
  await callbackHandler(ctx, {
    query: { code: 'abc', state: 'attacker-state' },
    headers: { ...REQ_HEADERS, cookie: 'decap_cms_github_oauth_state=real-state' },
  });
  assert.ok(
    ctx.res.body.includes('OAuth state verification failed.'),
    'a mismatched state must not proceed to the token exchange',
  );
});

test('auth: the OAuth scope is fixed at public_repo and ignores ?scope=', async () => {
  process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
  process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.SITE_ORIGIN = 'https://www.universaltill.com';

  const ctx = fakeContext();
  await authHandler(ctx, {
    query: { provider: 'github', scope: 'repo,admin:org,delete_repo,workflow' },
    headers: REQ_HEADERS,
  });

  const body = ctx.res.body;
  assert.ok(body.includes('scope=public_repo'), 'expected the hard-coded public_repo scope');
  assert.ok(!body.includes('admin%3Aorg'), 'attacker-supplied scope leaked into the authorize URL');
  assert.ok(!body.includes('delete_repo'), 'attacker-supplied scope leaked into the authorize URL');

  // The client secret must never reach the browser.
  assert.ok(!body.includes('test-client-secret'), 'client secret leaked into the response body');
});
