// Static Web Apps route matching, shared by scripts/serve-site.js (the
// Playwright server) and scripts/seo-inventory.mjs (ut-docs#6887), so both
// resolve a URL to a file exactly as site/staticwebapp.config.json says.
import fs from "node:fs";
import path from "node:path";

// Azure's matcher is richer than this; "exact path, or a trailing /* prefix"
// covers every pattern this site actually uses.
// A plain route matches with or without a trailing slash, as on Azure
// (ut-docs#3809: "/downloads" also answers "/downloads/").
export function matches(pattern, urlPath) {
  if (pattern.endsWith("/*")) return urlPath.startsWith(pattern.slice(0, -1));
  return pattern === urlPath || (urlPath.length > 1 && pattern === urlPath.replace(/\/$/, ""));
}

/**
 * URL path -> what the config says about it. No navigationFallback here: the
 * caller decides (serve-site falls back or 404s; the inventory fails the build).
 * @returns {{route: object|undefined, redirect: {status:number, location:string}|null,
 *            rewritten: string, filePath: string|null, forbidden: boolean}}
 */
export function resolveRequest(root, config, urlPath) {
  const route = (config.routes ?? []).find((r) => matches(r.route, urlPath));
  if (route?.redirect) {
    return { route, redirect: { status: route.statusCode ?? 302, location: route.redirect }, rewritten: urlPath, filePath: null, forbidden: false };
  }
  const rewritten = route?.rewrite ?? urlPath;
  let filePath = path.join(root, rewritten);
  const rootDir = path.resolve(root);
  if (!(path.resolve(filePath) + path.sep).startsWith(rootDir + path.sep)) {
    return { route, redirect: null, rewritten, filePath: null, forbidden: true };
  }
  // Astro emits directory-style URLs (dist/en-gb/blog/index.html for /en-gb/blog).
  if (!path.extname(filePath) && fs.existsSync(path.join(filePath, "index.html"))) {
    filePath = path.join(filePath, "index.html");
  }
  return { route, redirect: null, rewritten, filePath: fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : null, forbidden: false };
}
