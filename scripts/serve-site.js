#!/usr/bin/env node
// Minimal static file server for site/, used only by the Playwright test
// suite (playwright.config.js's webServer). Deliberately built on Node's
// built-in http/fs modules rather than adding an http-server devDependency —
// site/ itself ships with no build step and no runtime dependency, and this
// script is test tooling, not part of the shipped site.
// ESM, not CommonJS: package.json declares "type": "module" (required by the
// Astro build), so `require`/`__dirname` are not defined in this scope —
// same reasoning as scripts/check-i18n-keys.js.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/, not site/: since the Astro build landed, dist/ is what deploys —
// site/ passes through it byte-for-byte (publicDir), but the blog, its posts
// and /plugins exist ONLY in the build output. Serving site/ makes every test
// for those pages unreachable rather than failing, which is the same
// looks-covered-but-isn't trap as this site's navigationFallback.
const ROOT = path.join(__dirname, "..", "dist");

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("dist/ has no index.html — run `npm run build` first.");
  process.exit(1);
}
const PORT = Number(process.env.PORT) || 4173;

// Mirrors the handful of pretty-URL rewrites in site/staticwebapp.config.json
// closely enough for tests: bare paths and lang-prefixed paths (/fa, /tr,
// /zh) all serve index.html so client-side i18n.js can pick the language
// from the URL, and the known page routes map to their .html file.
const ROUTES = {
  "/download": "/download.html",
  "/start": "/start.html",
  "/store": "/store.html",
  "/language": "/language.html",
};
const LANGS = new Set(["tr", "zh", "fa"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (ROUTES[urlPath]) {
    urlPath = ROUTES[urlPath];
  } else {
    const seg = urlPath.split("/").filter(Boolean)[0];
    if (urlPath === "/" || (seg && LANGS.has(seg) && urlPath === "/" + seg)) {
      urlPath = "/index.html";
    } else {
      const rest = seg && LANGS.has(seg) ? urlPath.slice(seg.length + 1) : null;
      if (rest && ROUTES[rest]) urlPath = ROUTES[rest];
    }
  }

  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");

  // Astro emits directory-style URLs (dist/blog/index.html for /blog), which
  // Azure Static Web Apps resolves in production. Resolve them here too, or
  // every Astro-built page 404s in tests while working live. Extensionless
  // paths only, so a genuinely missing /styles.css still 404s rather than
  // silently answering with HTML.
  if (!path.extname(filePath)) {
    const asDirIndex = path.join(filePath, "index.html");
    if (fs.existsSync(asDirIndex)) filePath = asDirIndex;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    send(res, 200, data, type);
  });
});

server.listen(PORT, () => {
  console.log(`serve-site: listening on http://localhost:${PORT}`);
});
