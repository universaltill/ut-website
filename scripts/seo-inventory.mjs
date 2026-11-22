#!/usr/bin/env node
// Writes <dist>/seo/inventory.json (ut-docs#6887, ADR-0211 section 3). Runs after
// postbuild so it reads the final HTML. Exit 1 on a build-failing inconsistency.
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadList } from "./lib/locales.mjs";
import { buildInventory, serializeInventory } from "./lib/seo-inventory.mjs";

const dist = path.resolve(process.env.UT_OUT_DIR || path.join(ROOT, "dist"));
try {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "staticwebapp.config.json"), "utf8"));
  const map = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "seo-keyword-map.json"), "utf8"));
  const inv = buildInventory({ distDir: dist, config, list: loadList(), map, env: process.env, now: new Date() });
  const body = serializeInventory(inv);
  fs.mkdirSync(path.join(dist, "seo"), { recursive: true });
  fs.writeFileSync(path.join(dist, "seo", "inventory.json"), body);
  console.log(`seo-inventory: ${inv.rows.length} rows, ${Buffer.byteLength(body)} bytes, ${inv.problems.length} problems`);
  for (const p of inv.problems) console.log(`  problem ${p.code} ${p.path ?? "-"}: ${p.message}`);
} catch (e) {
  console.error(String(e.message || e).startsWith("seo-inventory") || String(e.message).startsWith("seo-keyword-map") ? e.message : `seo-inventory: ${e.stack || e}`);
  process.exit(1);
}
