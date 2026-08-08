#!/usr/bin/env node
// Minimal static file server for the BUILT site (dist/), used only by the
// Playwright suite (playwright.config.js's webServer). Built on Node's own
// http/fs rather than an http-server dependency — this is test tooling, not
// part of the shipped site.
//
// ESM, not CommonJS: package.json declares "type": "module" (required by the
// Astro build), so `require`/`__dirname` are not defined in this scope —
// same reasoning as scripts/check-i18n-keys.js.
//
// It serves dist/, not site/: since the Astro build landed, dist/ is what
// deploys — site/ passes through it byte-for-byte (publicDir), but the blog,
// its posts and /plugins exist ONLY in the build output. Serving site/ makes
// every test for those pages unreachable rather than failing.
//
// **It reads site/staticwebapp.config.json and applies those routes** instead
// of reimplementing them. Routing IS the thing under test on this site: a
// locale prefix resolving to the wrong file, or navigationFallback answering
// 200-with-the-homepage for a path that does not exist, are exactly the
// failures that keep reaching production looking like successes. A
// hand-maintained approximation here would drift from the real config and
// quietly bless it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT) || 4173;

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("dist/ has no index.html — run `npm run build` first.");
  process.exit(1);
}

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "site", "staticwebapp.config.json"), "utf8"),
);
const ROUTES = config.routes ?? [];
const FALLBACK = config.navigationFallback ?? {};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

// Azure's matcher is richer than this; "exact path, or a trailing /* prefix"
// covers every pattern this site actually uses.
function matches(pattern, urlPath) {
  if (pattern.endsWith("/*")) return urlPath.startsWith(pattern.slice(0, -1));
  return pattern === urlPath;
}

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const query = (req.url || "").includes("?") ? "?" + req.url.split("?")[1] : "";

  const route = ROUTES.find((r) => matches(r.route, urlPath));
  if (route?.redirect) {
    res.writeHead(route.statusCode ?? 302, { Location: route.redirect + query });
    return res.end();
  }
  if (route?.rewrite) urlPath = route.rewrite;

  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");

  // Astro emits directory-style URLs (dist/en-gb/blog/index.html for
  // /en-gb/blog), which Static Web Apps resolves in production.
  if (!path.extname(filePath) && fs.existsSync(path.join(filePath, "index.html"))) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    const excluded = (FALLBACK.exclude ?? []).some((p) => matches(p, urlPath));
    if (FALLBACK.rewrite && !excluded) {
      filePath = path.join(ROOT, FALLBACK.rewrite);
    } else {
      return send(res, 404, "Not found");
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found");
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(PORT, () => {
  console.log(`serve-site: listening on http://localhost:${PORT} (dist/, SWA routes applied)`);
});
