// node --test src/lib/plugins_test.mjs — unit tests for src/lib/plugins.ts
// (ut-docs#4645) with fetch stubbed, so the logo/screenshot pipeline is
// checked even though no plugin repo ships a real picture today. plugins.ts is
// TypeScript importing JSON, so esbuild (already a devDependency) bundles it
// into a temporary ES module first.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const LIST = JSON.parse(fs.readFileSync(path.join(here, "plugin-list.json"), "utf8"));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
after(() => fs.rmSync(TMP, { recursive: true, force: true }));
let builds = 0;

// A fresh bundle per call, so each test gets its own loadPlugins() cache.
async function freshModule(entry = path.join(here, "plugins.ts")) {
  const out = path.join(TMP, `m${builds++}.mjs`);
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "silent", external: ["astro"] });
  return import(pathToFileURL(out).href);
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

// routes: URL suffix (after .../<repo>/main/) → Uint8Array | object (JSON) | number (HTTP status)
function stubFetch(routes) {
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(url);
    const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/universaltill\/([^/]+)\/main\/(.+)$/);
    const body = m ? routes[`${m[1]}/${m[2]}`] : undefined;
    if (body === undefined) return new Response("not found", { status: 404 });
    if (typeof body === "number") return new Response("err", { status: body });
    if (body instanceof Uint8Array) return new Response(body, { status: 200 });
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return seen;
}

const manifest = (over = {}) => ({
  id: "com.universaltill.x",
  name: "X Plugin",
  version: "1.2.3",
  description: "Does a thing. And then much more detail.",
  canonical_type: "payment",
  author: "Universal Till",
  device_arch: "any",
  min_pos_version: "1.0.0",
  permissions: ["pos.tender"],
  ...over,
});

test("taglineOf: first sentence, or the whole text when there is none", async () => {
  const { taglineOf } = await freshModule();
  assert.equal(taglineOf("Take card payments through SumUp. With a paired reader, more."), "Take card payments through SumUp.");
  assert.equal(taglineOf("Dark theme — low glare"), "Dark theme — low glare");
  assert.equal(taglineOf("Version 1.2 works. Next."), "Version 1.2 works.");
});

test("letterOf: skips a leading 'Universal Till', handles non-Latin names", async () => {
  const { letterOf } = await freshModule();
  assert.equal(letterOf("Universal Till FAQ"), "F");
  assert.equal(letterOf("stripe Payments"), "S");
  assert.equal(letterOf("Ödeme"), "Ö");
  assert.equal(letterOf("Universal Till"), "U");
});

test("permissionKey: plain-language key where one exists, null otherwise", async () => {
  const { permissionKey } = await freshModule();
  assert.equal(permissionKey("net:api.sumup.com"), "pluginspage.perm.net");
  assert.equal(permissionKey("net:*"), "pluginspage.perm.net_any");
  assert.equal(permissionKey("net:@setting:endpoint_url"), "pluginspage.perm.net_setting");
  assert.equal(permissionKey("ui.page"), "pluginspage.perm.page");
  assert.equal(permissionKey("ui:page"), "pluginspage.perm.page");
  assert.equal(permissionKey("view:sales"), "pluginspage.perm.view");
  assert.equal(permissionKey("ui:slot:reports.panels"), "pluginspage.perm.slot");
  assert.equal(permissionKey("view:"), null);
  assert.equal(permissionKey("something:new"), null);
});

test("loadPlugins: icon and screenshots are copied as PNG/JPEG/WebP only", async () => {
  const [first] = LIST;
  stubFetch({
    [`${first.repo}/manifest.json`]: manifest({
      resources: { icon: "assets/icon.png", screenshots: ["a.png", "b.jpg", "c.webp", "d.svg", "e.png", "f.png"] },
    }),
    [`${first.repo}/assets/icon.png`]: PNG,
    [`${first.repo}/a.png`]: PNG,
    [`${first.repo}/b.jpg`]: JPEG,
    [`${first.repo}/c.webp`]: WEBP,
    [`${first.repo}/d.svg`]: SVG,
    [`${first.repo}/e.png`]: new TextEncoder().encode("placeholder icon"),
    // f.png is a 404
  });
  const { loadPlugins } = await freshModule();
  const plugins = await loadPlugins();
  assert.equal(plugins.length, 1, "only the plugin whose manifest answered");
  const p = plugins[0];
  const slug = first.repo.replace(/^ut-plugin-/, "");
  assert.equal(p.slug, slug);
  assert.equal(p.tagline, "Does a thing.");
  assert.deepEqual(p.icon && { path: p.icon.path, type: p.icon.contentType }, { path: `/plugin-assets/${slug}/icon.png`, type: "image/png" });
  assert.deepEqual(
    p.screenshots.map((s) => [s.path, s.contentType]),
    [
      [`/plugin-assets/${slug}/screenshot-1.png`, "image/png"],
      [`/plugin-assets/${slug}/screenshot-2.jpg`, "image/jpeg"],
      [`/plugin-assets/${slug}/screenshot-3.webp`, "image/webp"],
    ],
  );
});

test("loadPlugins: an oversized icon, an unsafe path and too many screenshots are refused", async () => {
  const [first] = LIST;
  const big = new Uint8Array(512 * 1024 + 1);
  big.set(PNG);
  const shots = Array.from({ length: 9 }, (_, i) => `s${i}.png`);
  const routes = {
    [`${first.repo}/manifest.json`]: manifest({ resources: { icon: "big.png", screenshots: ["../../other/x.png", "https://evil.example/x.png", ...shots] } }),
    [`${first.repo}/big.png`]: big,
  };
  for (const s of shots) routes[`${first.repo}/${s}`] = PNG;
  const seen = stubFetch(routes);
  const { loadPlugins } = await freshModule();
  const [p] = await loadPlugins();
  assert.equal(p.icon, null);
  assert.ok(!seen.some((u) => u.includes("evil.example") || u.includes("..")), "unsafe paths are never fetched");
  // At most six screenshot entries are considered; the two unsafe ones count.
  assert.equal(p.screenshots.length, 4);
});

test("loadPlugins: no manifests at all still resolves (the build must not fail)", async () => {
  stubFetch({});
  const { loadPlugins } = await freshModule();
  assert.deepEqual(await loadPlugins(), []);
});

test("loadPlugins: fetched once per build however many pages ask", async () => {
  const seen = stubFetch({});
  const { loadPlugins } = await freshModule();
  await Promise.all([loadPlugins(), loadPlugins(), loadPlugins()]);
  assert.equal(seen.length, LIST.length);
});

test("loadPlugins: a manifest that isn't a JSON object drops that plugin, not the build", async () => {
  const [first, second] = LIST;
  stubFetch({ [`${first.repo}/manifest.json`]: null, [`${second.repo}/manifest.json`]: manifest() });
  // stubFetch serialises null as the JSON literal null.
  const { loadPlugins } = await freshModule();
  const plugins = await loadPlugins();
  assert.deepEqual(plugins.map((p) => p.repo), [second.repo]);
});

test("loadPlugins: a declared Content-Length over the cap is refused before the body is read", async () => {
  const [first] = LIST;
  stubFetch({ [`${first.repo}/manifest.json`]: manifest({ resources: { icon: "icon.png" } }) });
  const inner = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.ok(init?.signal, "every fetch carries a timeout signal");
    if (!url.endsWith("icon.png")) return inner(url);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": String(10 * 1024 * 1024) }),
      arrayBuffer: () => assert.fail("body read despite the declared size"),
    };
  };
  const { loadPlugins } = await freshModule();
  const [p] = await loadPlugins();
  assert.equal(p.icon, null);
});

// The /plugin-assets/<slug>/<file> endpoint (src/pages/plugin-assets/[slug]/
// [file].ts): one route per copied picture, answering its bytes with the
// sniffed type. No plugin ships a real picture yet, so the build alone never
// exercises it.
test("plugin-assets endpoint: one route per picture, bytes and type preserved", async () => {
  const [first] = LIST;
  const slug = first.repo.replace(/^ut-plugin-/, "");
  stubFetch({
    [`${first.repo}/manifest.json`]: manifest({ resources: { icon: "i.png", screenshots: ["s.jpg"] } }),
    [`${first.repo}/i.png`]: PNG,
    [`${first.repo}/s.jpg`]: JPEG,
  });
  const ep = await freshModule(path.join(here, "../pages/plugin-assets/[slug]/[file].ts"));
  const paths = await ep.getStaticPaths();
  assert.deepEqual(
    paths.map((r) => r.params),
    [{ slug, file: "icon.png" }, { slug, file: "screenshot-1.jpg" }],
  );
  for (const [i, want, type] of [[0, PNG, "image/png"], [1, JPEG, "image/jpeg"]]) {
    const res = await ep.GET({ props: paths[i].props });
    assert.equal(res.headers.get("content-type"), type);
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), want);
  }
});
