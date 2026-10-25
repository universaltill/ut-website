// The ut-cms-web image: the Decap admin page (cms/web/index.html) and the
// nginx server block in front of it (cms/web/default.conf). Ported from
// homelab-k8s kubernetes/apps/ut-cms/tests/{admin-page,hosts}.test.js, which
// read the same text out of ConfigMaps; Azure Container Apps has no
// ConfigMaps, so the files are baked into the image instead (Phase 2 design
// card C4, ut-docs#4998). These tests read the exact files the Dockerfile
// copies in.
//
// The oauth2-proxy flag checks (redirect URL, host-only cookie, skip-auth
// routes) are NOT here: those flags live with the app definition (homelab-k8s
// today, ut-infra planes/azure-frc-apps from card C6), and are tested there.
//
// Run: node --test cms/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const webDir = path.join(__dirname, '..', 'web');
const page = fs.readFileSync(path.join(webDir, 'index.html'), 'utf8');
const conf = fs.readFileSync(path.join(webDir, 'default.conf'), 'utf8');
const dockerfile = fs.readFileSync(path.join(webDir, 'Dockerfile'), 'utf8');

// Only real config lines, never comments: the files explain themselves in
// prose, and a comment must not satisfy (or trip) a check.
const code = (text) =>
  text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

function decapConfig() {
  const match = page.match(
    /<script id="decap-cms-config" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'the decap-cms-config script block is gone');
  return match[1];
}

test('the Decap config is valid JSON — a // comment here blanks the whole CMS', () => {
  assert.doesNotThrow(
    () => JSON.parse(decapConfig()),
    'JSON.parse failed: the admin page will render "CMS failed to load"',
  );
});

test('posts are filed where the site actually reads them', () => {
  const blog = JSON.parse(decapConfig()).collections.find((c) => c.name === 'blog');
  // This repo builds pages from src/content/blog/<locale>/. A post saved one
  // directory up merges and then never appears — every step reports success.
  assert.strictEqual(blog.folder, 'src/content/blog/en-gb/');
  assert.strictEqual(blog.extension, 'mdx');
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', blog.folder)), `${blog.folder} does not exist in this repo`);
});

test('the backend points at the CMS host, not the marketing site', () => {
  const config = JSON.parse(decapConfig());
  assert.strictEqual(config.backend.base_url, 'https://cms.universaltill.com');
  assert.strictEqual(config.backend.auth_endpoint, 'api/auth');
  assert.strictEqual(config.backend.repo, 'universaltill/ut-website');
  assert.doesNotMatch(page, /admin\.universaltill\.com/, 'admin. is ut-admin-app since ut-docs#2603');
});

test('the Decap script is pinned with Subresource Integrity', () => {
  assert.match(
    page,
    /src="https:\/\/unpkg\.com\/decap-cms@\d+\.\d+\.\d+\/dist\/decap-cms\.js"\s+integrity="sha384-[A-Za-z0-9+/=]{64}"\s+crossorigin="anonymous"/,
  );
});

test('nginx: /version reports the pinned Decap release', () => {
  const pinned = page.match(/unpkg\.com\/decap-cms@(\d+\.\d+\.\d+)\/dist\/decap-cms\.js/);
  assert.ok(pinned, 'the pinned decap-cms script tag is gone');
  const loc = code(conf).match(/location = \/version \{([\s\S]*?)\n\s{2}\}/);
  assert.ok(loc, 'nginx has no exact-match /version location');
  const body = loc[1].match(/return 200 '([^']*)';/);
  assert.ok(body, '/version must return a fixed 200 body');
  const v = JSON.parse(body[1]);
  assert.strictEqual(v.app, 'ut-cms');
  assert.strictEqual(v.decap, pinned[1], '/version drifted from the pinned decap-cms script');
  assert.match(loc[1], /default_type application\/json;/);
});

test('nginx: binds loopback only — oauth2-proxy is the only way in', () => {
  // Any 0.0.0.0 listener would let a neighbour on the network fetch the page,
  // or reach the token-minting relay, without passing the Zitadel gate.
  const listens = code(conf).match(/^\s*listen\s+[^;]+;/gm) || [];
  assert.deepStrictEqual(listens.map((l) => l.trim()), ['listen       127.0.0.1:8080;']);
});

test('nginx: unknown paths 404 — no SPA fallback to index.html', () => {
  assert.match(code(conf), /try_files \$uri \$uri\/ =404;/);
  assert.doesNotMatch(code(conf), /try_files[^;]*\/index\.html/);
});

test('image: config is baked in from these files, nothing is fetched at start', () => {
  const d = code(dockerfile);
  assert.match(d, /^COPY index\.html \/usr\/share\/nginx\/html\/index\.html$/m);
  assert.match(d, /^COPY default\.conf \/etc\/nginx\/conf\.d\/default\.conf$/m);
  assert.match(d, /^COPY nginx\.conf \/etc\/nginx\/nginx\.conf$/m);
});
