#!/usr/bin/env node
// Runs after `astro build` (package.json "build"), so CI and the deploy both
// ship its output (ut-docs#3520, PageSpeed):
//  - inlines site/styles.css into every built page as a <style>, so first
//    paint doesn't wait on a render-blocking /styles.css request. The CSP
//    already allows inline styles (style-src 'unsafe-inline'); the CSS only
//    uses data: URIs, so moving it into pages under /xx-xx/ breaks no url().
//  - minifies the site scripts (i18n.js, nav.js, consent.js). They are
//    classic scripts sharing globals, and esbuild's transform without a
//    `format` never renames top-level names, so cross-script globals and
//    inline handlers keep working.
// charset utf8: the default escapes every non-ASCII character (the tr/zh/fa
// strings) as \uXXXX, which made i18n.js 35% BIGGER. The sources already
// ship raw UTF-8, so this changes nothing about how browsers decode them.
// Sources in site/ stay readable; only dist/ changes. Run once per fresh
// `astro build` (re-running re-minifies already-minified JS).
import fs from "node:fs";
import path from "node:path";
import { transform } from "esbuild";

const DIST = path.resolve(import.meta.dirname, "../dist");
const SCRIPTS = ["i18n.js", "nav.js", "consent.js"];
// es2017, not newer: the sources deliberately avoid `??`, `?.` and
// `catch {}` (nav.js keeps a Safari < 14 fallback), and a newer target lets
// esbuild rewrite `v != null ? v : x` into `v ?? x` — a SyntaxError that
// kills the whole file on old Android WebViews / iOS 13 (#3520 review).
const TARGET = "es2017";
const LINK = /<link\s+rel="stylesheet"\s+href="\/styles\.css"\s*\/?>/g;

const css = (await transform(fs.readFileSync(path.join(DIST, "styles.css"), "utf8"), { loader: "css", minify: true, target: TARGET, charset: "utf8" })).code.trim();
if (/<\/style/i.test(css)) throw new Error("postbuild: styles.css contains </style; refusing to inline");
// Kept as a stable URL for anything outside these pages, but minified too.
fs.writeFileSync(path.join(DIST, "styles.css"), css);

for (const name of SCRIPTS) {
  const file = path.join(DIST, name);
  const { code } = await transform(fs.readFileSync(file, "utf8"), { loader: "js", minify: true, target: TARGET, legalComments: "none", charset: "utf8" });
  fs.writeFileSync(file, code);
}

const pages = fs.readdirSync(DIST, { recursive: true }).filter((f) => f.endsWith(".html"));
let inlined = 0;
for (const rel of pages) {
  const file = path.join(DIST, rel);
  const html = fs.readFileSync(file, "utf8");
  if (!LINK.test(html)) continue;
  LINK.lastIndex = 0;
  fs.writeFileSync(file, html.replace(LINK, () => `<style>${css}</style>`));
  inlined++;
}
// A <link> the regex didn't match (new attribute, different order) would
// silently stay render-blocking; fail the build instead.
const left = pages.filter((rel) => /href=["']\/styles\.css["']/.test(fs.readFileSync(path.join(DIST, rel), "utf8")));
if (left.length) throw new Error(`postbuild: still linking /styles.css: ${left.join(", ")}`);
console.log(`postbuild: minified ${SCRIPTS.join(", ")}; inlined styles.css into ${inlined}/${pages.length} pages`);
