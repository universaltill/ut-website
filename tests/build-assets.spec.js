// ut-docs#3520 — PageSpeed "Render-blocking requests" (/styles.css, ~120 ms on
// mobile) and "Minify JavaScript" (/i18n.js). scripts/postbuild.mjs inlines
// the one stylesheet into every built page and minifies the site scripts, so
// sources in site/ stay readable while what ships is lean. The rest of the
// suite runs against that same built output, so a minifier that broke
// i18n.js or nav.js fails there too.
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");

test("built pages inline the stylesheet instead of blocking on /styles.css", async ({ request }) => {
  const css = fs.readFileSync(path.join(ROOT, "site/styles.css"), "utf8");
  // A distinctive rule from the source, to prove the CSS really is inlined.
  // A selector, not a value: minifiers rewrite values (0.5 → .5), never names.
  const marker = ".hero-art";
  expect(css).toContain(marker);
  for (const url of ["/en-gb", "/de-de/download", "/fa-ir/pilot", "/en-gb/blog/", "/language", "/en-gb/plugins", "/en-gb/legal/privacy"]) {
    const html = await (await request.get(url)).text();
    expect(html, `${url} links /styles.css`).not.toMatch(/<link[^>]+href="\/styles\.css"/);
    const inline = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1].replace(/\s+/g, "")).join("");
    expect(inline, `${url} inlines styles.css`).toContain(marker);
  }
});

for (const name of ["i18n.js", "nav.js", "consent.js"]) {
  test(`/${name} ships minified`, async ({ request }) => {
    const src = fs.readFileSync(path.join(ROOT, "site", name), "utf8");
    const served = await (await request.get(`/${name}`)).text();
    // i18n.js is mostly translation strings, so it only shrinks ~12%.
    expect(served.length, `${name} is smaller than its source`).toBeLessThan(src.length * 0.95);
    expect(served, `${name} keeps no line comments`).not.toMatch(/^\s*\/\/ /m);
    expect(served, `${name} keeps no indentation`).not.toMatch(/\n {2,}\S/);
    // Non-ASCII stays raw UTF-8 (esbuild's default \uXXXX escaping grew it 35%).
    // No syntax newer than the source uses (es2017 target, #3520 review).
    for (const tok of ["??", "?.", "catch{"]) if (!src.includes(tok)) expect(served, `${name} gained ${tok}`).not.toContain(tok);
    const escapes = (t) => (t.match(/\\u[0-9a-fA-F]{4}/g) || []).length;
    expect(escapes(served), `${name} gained \\u escapes`).toBeLessThanOrEqual(escapes(src));
  });
}
