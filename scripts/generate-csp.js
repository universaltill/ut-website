#!/usr/bin/env node
// Generates the `script-src` hash list for the Content-Security-Policy in
// site/staticwebapp.config.json's `globalHeaders`, and checks the checked-in
// file is up to date with it.
//
// Why hashes, not 'unsafe-inline': the executable inline <script>s on this
// site (the www-canonicalization redirect in every page, download.html's
// OS-detect/live-release-upgrade logic, language.html's locale-switcher) are
// static/build-time content — there is no per-request nonce a static host
// can hand out, and 'unsafe-inline' would defeat the point of having a CSP
// at all (see ut-docs#442). A SHA-256 hash allowlists the exact, known-good
// script body instead.
//
// **`<script type="application/ld+json">` (each blog post's structured
// data) is deliberately EXCLUDED from this hash list, not hashed** — an
// independent review of this ticket (2026-08-24) caught an earlier draft
// hashing these too, on the mistaken assumption they needed it the same way
// the executable scripts do. They don't: CSP's script-src only ever governs
// a <script> whose type is empty/a JS MIME type/"module"/"importmap" (HTML's
// "prepare the script element" algorithm returns early for any other type,
// before the inline-check step CSP hooks into) — verified empirically
// against the pre-installed Chromium, both in isolation and by sweeping
// every one of this site's built pages with the JSON-LD hashes removed:
// zero securitypolicyviolation events. Hashing them anyway would have meant
// every new blog post/locale — unique body each time (title, dates,
// description; see src/pages/[...lang]/blog/[slug].astro) — churning
// `check-csp` in CI for a browser check that was never actually happening.
// This generator's real job is narrower, and still real: catch the executable
// scripts silently drifting out of sync (someone edits download.html's
// inline script and forgets to regenerate) the way check-i18n-keys.js and
// check-swa-config.js already catch their own class of silent drift.
//
// Usage:
//   node scripts/generate-csp.js --check   Fail (exit 1) if the CSP in
//                                           site/staticwebapp.config.json
//                                           doesn't match what dist/ actually
//                                           contains. Run in CI, after build.
//   node scripts/generate-csp.js --write   Rewrite the CSP in
//                                           site/staticwebapp.config.json (and
//                                           dist/staticwebapp.config.json, to
//                                           keep the build's byte-identical
//                                           publicDir guard passing) to match
//                                           dist/. Run locally after
//                                           `npm run build` whenever an inline
//                                           <script> changes, then commit the
//                                           diff — same workflow as
//                                           check-i18n-keys.js's locale keys.
//
// Either mode requires dist/ to already exist (`npm run build` first) — this
// script does not build the site itself, so it always reflects a real build
// output rather than re-deriving Astro's rendering.
//
// ESM, not CommonJS: package.json declares "type": "module", so
// `require`/`__dirname` aren't defined here — same reasoning as
// scripts/check-i18n-keys.js.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const siteConfigPath = path.join(root, "site", "staticwebapp.config.json");
const distConfigPath = path.join(root, "dist", "staticwebapp.config.json");

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--check")
    ? "check"
    : null;
if (!mode) {
  console.error("usage: node scripts/generate-csp.js --check | --write");
  process.exit(1);
}

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("generate-csp: dist/ has no index.html — run `npm run build` first.");
  process.exit(1);
}

// Directives that never change (no external resources anywhere on this site
// today — see docs/code-reviews/2026-08-24-website-csp-442.md for the
// inventory this was built from). script-src's hash list is the only part
// this script computes.
const STATIC_DIRECTIVES = {
  "default-src": ["'none'"],
  // style-src: 'unsafe-inline' is a deliberate, documented exception (not the
  // blanket kind the ticket warns against) — this site has several dozen
  // one-off `style="..."` layout attributes across site/*.html and
  // src/**/*.astro (a moving count as pages change; not worth tracking
  // precisely here), and a CSS injection via style-src is a materially
  // smaller blast radius than a script-src one: no arbitrary JS execution,
  // and no data-exfiltration channel either, since img-src/font-src/
  // connect-src below are all narrow (no `url()` beacon to an attacker
  // host is reachable from injected CSS). Converting every inline style to
  // a class is out of scope for this card.
  "style-src": ["'self'", "'unsafe-inline'"],
  // data: covers the SVG data-URI icon masks in styles.css
  // (.ico-grocery/.ico-retail/etc.) — no other image source exists.
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  // download.html's client-side "upgrade to the live release" fetch
  // (site/download.html) is the one cross-origin call this site makes.
  "connect-src": ["'self'", "https://api.github.com"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

// Script types script-src actually governs: no type attribute at all,
// an explicit JS MIME type, "module", or "importmap". Anything else
// (application/ld+json, application/json, text/template, ...) is a plain
// data block the browser never treats as a script to execute — CSP has
// nothing to say about it, so it needs no hash. See the file header for
// why this distinction is the whole point of MAJOR-1's fix.
const JS_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "application/ecmascript",
  "module",
  "importmap",
]);

function isExecutableScriptType(attrs) {
  const m = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  if (!m) return true; // no type attribute -> defaults to JS
  const type = (m[1] ?? m[2]).trim().toLowerCase();
  return JS_SCRIPT_TYPES.has(type);
}

function findInlineScriptHashes() {
  const htmlFiles = fs
    .readdirSync(distDir, { recursive: true })
    .filter((f) => f.endsWith(".html"))
    .map((f) => path.join(distDir, f));

  const hashes = new Set();
  const scriptRe = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(scriptRe)) {
      const attrs = m[1];
      const body = m[2];
      if (body.trim() === "") continue; // nothing to allowlist
      if (!isExecutableScriptType(attrs)) continue; // e.g. application/ld+json — not script-src's concern
      const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
      hashes.add(`'sha256-${hash}'`);
    }
  }
  if (hashes.size === 0) {
    console.error(
      "generate-csp: found zero executable inline <script> bodies across dist/**/*.html — " +
        "the extraction regex is broken, not the site (there are always at least " +
        "the www-canonicalization redirect and download.html's asset-detect script).",
    );
    process.exit(1);
  }
  return [...hashes].sort();
}

function buildCSP(scriptHashes) {
  const directives = {
    ...STATIC_DIRECTIVES,
    "script-src": ["'self'", ...scriptHashes],
  };
  // Fixed key order so the generated value — and its diffs — are stable.
  const order = [
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
  ];
  return order.map((k) => `${k} ${directives[k].join(" ")}`).join("; ");
}

const scriptHashes = findInlineScriptHashes();
const csp = buildCSP(scriptHashes);

const siteConfig = JSON.parse(fs.readFileSync(siteConfigPath, "utf8"));
const current = siteConfig.globalHeaders?.["Content-Security-Policy"];

if (mode === "check") {
  if (current !== csp) {
    console.error("generate-csp: staticwebapp.config.json's CSP is out of date.\n");
    console.error(`  committed: ${current ?? "(missing)"}\n`);
    console.error(`  expected:  ${csp}\n`);
    console.error(
      "Run `npm run build && node scripts/generate-csp.js --write` and commit the diff " +
        "(a new or changed executable inline <script> — e.g. editing download.html's or " +
        "language.html's own inline logic — needs its hash added; a blog post's JSON-LD " +
        "does not, see the file header).",
    );
    process.exit(1);
  }
  console.log(`generate-csp: OK (${scriptHashes.length} script-src hash(es) up to date)`);
  process.exit(0);
}

// --write
siteConfig.globalHeaders = { ...siteConfig.globalHeaders, "Content-Security-Policy": csp };
const written = JSON.stringify(siteConfig, null, 2) + "\n";
fs.writeFileSync(siteConfigPath, written);
// Keep dist/ in sync too — astro build copies publicDir (site/) to dist/ at
// the START of the build, before this script ever runs, so dist's copy is
// now stale relative to what we just wrote. The build job's byte-identical
// guard (site/ === dist/, file for file) checks dist AFTER this script has
// run in the same `npm run build && node scripts/generate-csp.js --write`
// sequence, so both copies must end up identical.
fs.writeFileSync(distConfigPath, written);
console.log(`generate-csp: wrote ${scriptHashes.length} script-src hash(es) to staticwebapp.config.json (site/ and dist/)`);
