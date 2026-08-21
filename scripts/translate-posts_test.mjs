#!/usr/bin/env node
// Regression test for translate-posts.js's verify() heuristic (ut-docs#871):
// proves every Latin-script locale (any LOCALES entry with no SCRIPT-map
// entry) gets the same "model handed back English unchanged" protection
// tr-tr had before this fix, and that the non-Latin-script (SCRIPT-mapped)
// path is unaffected. Run directly: `node scripts/translate-posts_test.mjs`.
//
// Uses Node's built-in test runner — no new dependency, same "shell out to
// the script itself, assert on outcome" spirit as guard-compliance-claims_test.sh,
// just in JS since the unit under test is a JS function, not a shell guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "./translate-posts.js";

// A source/translated pair with matching headings, links and product name —
// isolates each case to the one check it's meant to exercise.
function pair({ sourceTitle = "What's new", translatedTitle, body = "## Universal Till\n[a](/x)" }) {
  const source = { title: sourceTitle, body };
  const translated = { title: translatedTitle, body };
  return { source, translated };
}

test("Latin-script locale (de-de) flags an untranslated title — the bug this card fixes", () => {
  const { source, translated } = pair({ translatedTitle: "What's new" }); // model returned English verbatim
  const problems = verify(source, translated, "de-de");
  assert.ok(
    problems.some((p) => p.includes("identical to the English")),
    `expected an "identical to the English" problem, got: ${JSON.stringify(problems)}`,
  );
});

test("Latin-script locale (de-de) passes a genuinely translated title", () => {
  const { source, translated } = pair({ translatedTitle: "Was ist neu" });
  assert.deepEqual(verify(source, translated, "de-de"), []);
});

test("tr-tr keeps its existing untranslated-title protection", () => {
  const { source, translated } = pair({ translatedTitle: "What's new" });
  const problems = verify(source, translated, "tr-tr");
  assert.ok(problems.some((p) => p.includes("identical to the English")));
});

test("SCRIPT-mapped locale (zh-cn) is judged by script, not title equality", () => {
  // Title translated into Han script — must NOT also be flagged as
  // "identical to English" just because de-de/tr-tr's check exists.
  const { source, translated } = pair({ translatedTitle: "有什么新功能" });
  assert.deepEqual(verify(source, translated, "zh-cn"), []);
});

test("SCRIPT-mapped locale (fa-ir) still catches an untranslated title via the script check", () => {
  const { source, translated } = pair({ translatedTitle: "What's new" });
  const problems = verify(source, translated, "fa-ir");
  assert.ok(problems.some((p) => p.includes("not in the target script")));
  // Only one problem, not a duplicate from the Latin-script identical-title
  // branch — fa-ir has a SCRIPT entry, so that branch must not also fire.
  assert.equal(problems.length, 1);
});

test("a dropped heading or changed link is still caught, independent of locale", () => {
  const source = { title: "T", body: "## Universal Till\n## Two\n[a](/x)" };
  const translated = { title: "Übersetzt", body: "## Universal Till\n[a](/y)" };
  const problems = verify(source, translated, "de-de");
  assert.ok(problems.some((p) => p.includes("heading count")));
  assert.ok(problems.some((p) => p.includes("link targets changed")));
});
