// Every language the till ships must stay on the website (owner request 2026-11-11).
// A locale dropped from the published list, from i18n/<url>.json, from the generated
// i18n-data.js or from the SWA routes fails CI here; the built picker, sitemap and
// hreflang are then checked against the list by check-locale-consistency.mjs.
//   node --test scripts/required-locales_test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadList, websiteLocales } from "./lib/locales.mjs";

const REQUIRED = { "ar-sa": "rtl", "de-de": "ltr", "el-gr": "ltr", "en-gb": "ltr", "es-es": "ltr", "fa-ir": "rtl", "fr-fr": "ltr", "it-it": "ltr", "ms-my": "ltr", "pt-pt": "ltr", "tr-tr": "ltr", "zh-cn": "ltr" };
const list = loadList(path.join(ROOT, "i18n"));
const published = websiteLocales(list);
const data = fs.readFileSync(path.join(ROOT, "site", "i18n-data.js"), "utf8");
const swa = fs.readFileSync(path.join(ROOT, "site", "staticwebapp.config.json"), "utf8");

for (const [url, dir] of Object.entries(REQUIRED)) {
  test(`${url} is published on the website, ${dir}`, () => {
    const l = published.find((x) => x.url === url);
    assert.ok(l, `${url} missing from i18n/published/locales.json`);
    assert.equal(l.dir, dir);
    if (url !== "en-gb") assert.ok(fs.existsSync(path.join(ROOT, "i18n", `${url}.json`)), `i18n/${url}.json missing`);
    assert.ok(data.includes(`"${url}":`), `${url} missing from site/i18n-data.js (run gen-locales.mjs)`);
    assert.ok(swa.includes(`"/${url}`), `${url} has no route in staticwebapp.config.json`);
  });
}
