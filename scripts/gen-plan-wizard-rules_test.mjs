// ut-docs#4962: the wizard's answer -> plan mapping generator. Run: node --test scripts/gen-plan-wizard-rules_test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { build, render } from "./gen-plan-wizard-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const real = () => JSON.parse(fs.readFileSync(path.join(ROOT, "data/plan-wizard-rules.json"), "utf8"));
const mutated = (fn) => { const d = real(); fn(d); return d; };

test("the real file builds: country list expanded, plan ids mapped", () => {
  const out = build(real());
  const fiscal = out.rules.find((r) => r.id === "managed-fiscal");
  assert.deepEqual(fiscal.if.country, ["de"]);
  assert.deepEqual(out.managedFiscalMarkets, ["de"]);
  assert.equal(out.rules.find((r) => r.id === "multi").plan, "multi");
  assert.equal(out.rules.find((r) => r.id === "remote").plan, "plus");
  assert.equal(out.rules.find((r) => r.id === "huge").plan, "enterprise");
  assert.equal(out.rules.find((r) => r.id === "away").built, false);
  assert.equal(out.decidedOn, "2026-11-12");
  assert.equal("ladder_row" in out.rules[0], false);
});

const bad = {
  "unknown schema_version": (d) => { d.schema_version = 2; },
  "plans not the six ids": (d) => { d.plans = d.plans.slice(1); },
  "rule id with a capital": (d) => { d.plan_rules[0].id = "Huge"; },
  "duplicate rule id": (d) => { d.plan_rules[1].id = d.plan_rules[0].id; },
  "unknown plan": (d) => { d.plan_rules[0].plan = "team"; },
  "built as a string": (d) => { d.plan_rules[0].built = "true"; },
  "missing if": (d) => { delete d.plan_rules[0].if; },
  "empty if": (d) => { d.plan_rules[0].if = {}; },
  "empty option list": (d) => { d.plan_rules[0].if.sites = []; },
  "reference to a missing list": (d) => { d.plan_rules[2].if.country = "no_such_list"; },
  "empty managed_fiscal_markets": (d) => { d.managed_fiscal_markets = []; },
};
for (const [name, fn] of Object.entries(bad)) {
  test("rejects: " + name, () => {
    assert.throws(() => build(mutated(fn)), /^Error: plan-wizard-rules\.json: /);
  });
}

test("the committed site/plan-wizard-rules.js is what the generator renders", () => {
  assert.equal(fs.readFileSync(path.join(ROOT, "site/plan-wizard-rules.js"), "utf8"), render(build(real())));
});
