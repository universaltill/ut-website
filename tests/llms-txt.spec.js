// ut-docs#4319 — /llms.txt and /llms-full.txt (llmstxt.org): a plain-Markdown
// summary of the site for AI assistants, generated at build from the same
// sources as the pages (site/i18n.js, the blog and legal collections) so it
// can never drift from them.
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGIN = "https://www.universaltill.com";
const i18nSrc = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
const EN = (0, eval)("(" + i18nSrc.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/)[1] + ")")["en-gb"];

const frontmatter = (file) => {
  const fm = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/)[1];
  const get = (k) => (fm.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m")) || [])[1];
  return { title: get("title"), draft: get("draft") === "true" };
};
const blogDir = path.join(ROOT, "src/content/blog/en-gb");
const POSTS = fs.readdirSync(blogDir).map((f) => ({ slug: f.replace(/\.mdx$/, ""), ...frontmatter(path.join(blogDir, f)) }));

for (const file of ["/llms.txt", "/llms-full.txt"]) {
  test(`${file} is served as UTF-8 Markdown about Universal Till`, async ({ request }) => {
    const res = await request.get(file);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("text/plain; charset=utf-8");
    const body = await res.text();
    expect(body.split("\n")[0]).toBe("# Universal Till");
    expect(body).toMatch(/^> .*EPOS.*$/m);
    for (const p of POSTS.filter((p) => !p.draft)) expect(body).toContain(p.title);
    // A model has no base URL: every Markdown link is absolute.
    expect(body).not.toMatch(/\]\(\//);
  });
}

test("/llms.txt links only to pages that exist, and points at the full file", async ({ request }) => {
  const body = await (await request.get("/llms.txt")).text();
  // llmstxt.org: every list item under an H2 is a link.
  for (const line of body.split("\n").filter((l) => l.startsWith("- "))) expect(line).toMatch(/^- \[[^\]]+\]\([^)]+\)/);
  for (const q of FAQ_QS) expect(body).toContain(EN[q]);
  expect(body).toContain(`](${ORIGIN}/llms-full.txt)`);
  const links = [...body.matchAll(/\]\((https:\/\/www\.universaltill\.com[^)]*)\)/g)].map((m) => m[1]);
  expect(links.length).toBeGreaterThan(10);
  for (const url of new Set(links)) {
    const res = await request.get(url.slice(ORIGIN.length).replace(/#.*/, "") || "/", { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
  }
});

// The FAQ the home page actually renders (template order), not every faq.* key in the dict.
const index = fs.readFileSync(path.join(ROOT, "site/index.html"), "utf8");
const FAQ_QS = [...index.matchAll(/data-i18n="(faq\.q\d+)"/g)].map((m) => m[1]);

test("/llms-full.txt carries every English marketing page and every FAQ answer verbatim", async ({ request }) => {
  const body = await (await request.get("/llms-full.txt")).text();
  for (const k of ["hero.title", "hero.lede", "why.offline.d", "hw.lede", "about.title", "meta.download.title", "meta.start.title", "meta.pilot.title"]) {
    expect(body, k).toContain(EN[k]);
  }
  expect(body).not.toContain(EN["meta.language.title"]); // the noindex picker
  // Post bodies sit under "### <title>": none of their headings may outrank it.
  const blog = body.slice(body.indexOf("\n## Blog\n"));
  expect(blog.split("\n").filter((l) => /^#{1,3} /.test(l) && !l.startsWith("### ")).length).toBe(1); // just "## Blog"
  const qs = FAQ_QS;
  expect(qs.length).toBeGreaterThanOrEqual(6);
  for (const q of qs) {
    expect(body).toContain(EN[q]);
    expect(body).toContain(EN[q.replace(".q", ".a")]);
  }
  // HTML-bearing dict values are flattened to text, never leaked as tags.
  expect(body).not.toMatch(/<\/?(strong|a|br)\b/);
});
