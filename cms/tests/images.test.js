// Static checks on the two ut-cms Dockerfiles (Phase 2 design card C4,
// ut-docs#4998). This is a PUBLIC repo publishing PUBLIC images, so the rules
// here are the security floor: base images pinned by digest, a non-root user,
// and no secret — or anything that looks like one — baked into a layer.
// The runtime smoke test (the images start and answer /healthz) is the
// `cms-images` workflow's `smoke` job, which needs Docker.
//
// Run: node --test cms/tests/*.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const cmsDir = path.join(__dirname, '..');
const images = {
  web: fs.readFileSync(path.join(cmsDir, 'web', 'Dockerfile'), 'utf8'),
  relay: fs.readFileSync(path.join(cmsDir, 'relay', 'Dockerfile'), 'utf8'),
};
const code = (text) =>
  text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

for (const [name, dockerfile] of Object.entries(images)) {
  const d = code(dockerfile);

  test(`${name}: every base image is pinned to an exact tag AND a digest`, () => {
    const froms = d.match(/^FROM\s+\S+/gm) || [];
    assert.ok(froms.length > 0, 'no FROM line');
    for (const from of froms) {
      assert.match(from, /^FROM \S+:\d[\w.-]*@sha256:[0-9a-f]{64}$/, `${from} is not tag+digest pinned`);
    }
  });

  test(`${name}: the final stage runs as a numeric non-root user`, () => {
    const users = d.match(/^USER\s+\S+/gm) || [];
    assert.ok(users.length > 0, 'no USER line');
    const last = users[users.length - 1].split(/\s+/)[1];
    assert.match(last, /^[1-9]\d*$/, `final USER ${last} must be a numeric non-zero uid (runAsNonRoot can verify only that)`);
  });

  test(`${name}: no secret is baked in`, () => {
    // Secrets arrive at run time as FILES under SECRETS_DIR (a Key Vault
    // secret volume on Azure, the CSI mount on the homelab), never as an
    // image layer, a build arg or an ENV.
    // Any NAME=value or ARG NAME anywhere — ENV continuation lines included
    // (a per-line ^ENV check misses `ENV A=1 \` + `    GITHUB_SECRET=x`).
    // SECRETS_DIR is the one allowed name: a path, not a secret.
    const names = [
      ...d.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)=/g),
      ...d.matchAll(/^ARG\s+([A-Za-z_][A-Za-z0-9_]*)/gm),
    ].map((m) => m[1]).filter((n) => n !== 'SECRETS_DIR');
    for (const n of names) {
      assert.doesNotMatch(n, /SECRET|TOKEN|PASSW|KEY|CLIENT_ID|CREDENTIAL/i, `${n} looks like a secret baked into the image`);
    }
    assert.doesNotMatch(d, /secrets-store\/website-/);
    assert.doesNotMatch(d, /--mount=type=secret/);
  });

  test(`${name}: the image's entrypoint scripts are not used`, () => {
    assert.match(d, /^ENTRYPOINT \[\]$/m);
  });
}

test('relay: carries only relay.js, and no package manager', () => {
  const d = code(images.relay);
  const copies = d.match(/^COPY\s.+$/gm) || [];
  assert.deepStrictEqual(copies, ['COPY relay.js /app/relay.js']);
  // Dependency-free stdlib code: npm/yarn are attack surface with no use here.
  assert.match(d, /rm -rf[^\n]*\/usr\/local\/lib\/node_modules\/npm/);
});

test('relay: the non-secret config is baked into the image', () => {
  const d = code(images.relay);
  for (const env of ['SITE_ORIGIN=https://cms.universaltill.com', 'PORT=8081', 'NODE_ENV=production', 'SECRETS_DIR=/mnt/secrets-store']) {
    assert.ok(d.includes(env), `relay image is missing ${env}`);
  }
});

test('build context: .dockerignore admits only the files each image copies', () => {
  for (const dir of ['web', 'relay']) {
    const ignore = fs.readFileSync(path.join(cmsDir, dir, '.dockerignore'), 'utf8');
    assert.match(ignore, /^\*$/m, `${dir}/.dockerignore must start from "ignore everything"`);
  }
});
