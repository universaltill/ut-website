// ut-docs#4193 — the "Find your setup" wizard's rule table, as pure data.
// No browser: site/wizard-rules.js is a DOM-free classic script, loaded here
// into a bare vm context exactly the way a page would run it.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { expect, test } from "@playwright/test";

const ROOT = path.resolve(import.meta.dirname, "..");
const ctx = {};
for (const f of ["site/plan-prices.js", "site/wizard-rules.js"]) vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx);
const R = ctx.UT_WIZARD_RULES;

const base = { biz: "cafe", country: "uk", sites: "one", needs: [], card: "none", hardware: "have" };
const rec = (over) => R.recommend({ ...base, ...over });

test("every business type with no special need lands on the free local app", () => {
  for (const biz of R.QUESTIONS.find((q) => q.id === "biz").options) {
    const r = rec({ biz });
    expect(r.plan, biz).toBe("local");
    expect(r.route, biz).toBe("download");
    expect(r.price.kind).toBe("free");
  }
});

test("a skipped (empty) wizard still gives the free app, never an error", () => {
  const r = R.recommend({});
  expect(r.plan).toBe("local");
  expect(r.route).toBe("download");
  expect(R.recommend(undefined).plan).toBe("local");
});

test("tables, kitchen and stock are free on every plan, so they never force a paid one", () => {
  expect(rec({ biz: "restaurant", needs: ["tables", "stock"] }).plan).toBe("local");
});

test("cloud needs route to my.universaltill.com with the right plan and real UK price", () => {
  const remote = rec({ needs: ["remote"] });
  expect(remote).toMatchObject({ plan: "plus", route: "cloud" });
  expect(remote.price).toMatchObject({ kind: "monthly", currency: "GBP", monthly: 10 });
});

test("features that do not exist yet never raise the plan or the price; they are listed as coming", () => {
  for (const need of ["appointments", "online", "team"]) {
    const r = rec({ needs: [need] });
    expect(r.plan, need).toBe("local");
    expect(r.price, need).toEqual({ kind: "free" });
    expect(r.reasons, need).toEqual(["wiz.r.local"]);
    expect(r.gaps, need).toContain("wiz.gap." + need);
  }
  const all = rec({ biz: "salon", needs: ["appointments", "online", "team"] });
  expect(all.plan).toBe("local");
  // a real cloud need still decides the plan; the gaps just ride along
  const mixed = rec({ needs: ["remote", "online", "team"] });
  expect(mixed.plan).toBe("plus");
  expect(mixed.gaps).toEqual(expect.arrayContaining(["wiz.gap.online", "wiz.gap.team"]));
  expect(rec({ needs: ["online"], sites: "few" }).plan).toBe("multi");
});

test("no reason text claims a feature that is only a gap", () => {
  const reasons = R.PLAN_RULES.map((r) => r.id);
  for (const gone of ["team", "online", "appointments"]) expect(reasons).not.toContain(gone);
});

test("several locations: Multi-location, 3 included, extra locations priced", () => {
  const few = rec({ sites: "few" });
  expect(few).toMatchObject({ plan: "multi", route: "cloud" });
  expect(few.price).toMatchObject({ monthly: 120, annual: 100, includedLocations: 3, extraLocation: 33 });
  expect(rec({ sites: "many" }).price.extra).toBe(true);
  expect(few.price.extra).toBe(false);
});

test("more than 10 locations is Enterprise and chains: talk to us, no invented price", () => {
  const r = rec({ sites: "huge" });
  expect(r).toMatchObject({ plan: "enterprise", route: "talk" });
  expect(r.price).toEqual({ kind: "talk" });
});

test("Germany: a fiscal need means Shop with the per-main-till fiscal line; euro prices", () => {
  const r = rec({ country: "de", needs: ["fiscal"] });
  expect(r).toMatchObject({ plan: "shop", route: "cloud" });
  expect(r.price).toMatchObject({ currency: "EUR", monthly: 29, annual: 24.17, tse: 12 });
  expect(r.plugins).toContain("language-de");
  expect(r.notes).toContain("wiz.n.deowndevice");
  // other euro countries and the UK carry no fiscal line
  expect(rec({ country: "eu", needs: ["remote"] }).price).toMatchObject({ currency: "EUR", tse: 0 });
  expect(rec({ country: "uk", needs: ["fiscal"] }).plan).toBe("local");
});

test("Germany + Local Plus: own TSE, so NO managed TSE line; the law note says why", () => {
  const r = rec({ country: "de", needs: ["remote"] });
  expect(r.plan).toBe("plus");
  expect(r.price.tse).toBe(0);
  expect(r.notes).toContain("wiz.n.detse");
});

test("Germany with no fiscal tick: a TSE is required by law, so no copy implies zero total cost", () => {
  for (const needs of [[], ["remote"], ["tables"]]) expect(rec({ country: "de", needs }).notes, needs.join()).toContain("wiz.n.detse");
  expect(rec({ country: "de", sites: "few" }).notes).toContain("wiz.n.detse");
  expect(rec({ country: "uk" }).notes).not.toContain("wiz.n.detse");
  expect(rec({ country: "de", needs: ["fiscal"] }).notes).not.toContain("wiz.n.detse");
});

test("the 'stay on your own device' note shows only when the German fiscal need was the only reason", () => {
  expect(rec({ country: "de", needs: ["fiscal"] }).notes).toContain("wiz.n.deowndevice");
  for (const sites of ["few", "many"]) expect(rec({ country: "de", needs: ["fiscal"], sites }).notes, sites).not.toContain("wiz.n.deowndevice");
  expect(rec({ country: "de", needs: ["fiscal"], sites: "huge" }).notes).not.toContain("wiz.n.deowndevice");
});

test("another euro country + fiscal: an honest gap, never a claim about the law", () => {
  const r = rec({ country: "eu", needs: ["fiscal"] });
  expect(r.gaps).toContain("wiz.gap.fiscalother");
  expect(r.notes).not.toContain("wiz.n.eufiscal");
  expect(R.allKeys()).not.toContain("wiz.n.eufiscal");
});

test("a paid plan with no country asks for the country instead of saying 'not published'", () => {
  const r = R.recommend({ needs: ["remote"] });
  expect(r.plan).toBe("plus");
  expect(r.price).toEqual({ kind: "pick" });
  expect(R.recommend({ country: "tr", needs: ["remote"] }).price).toEqual({ kind: "unpublished" });
  expect(R.recommend({}).price).toEqual({ kind: "free" });
});

test("no price is invented for countries without a published ladder", () => {
  for (const country of ["tr", "other"]) {
    const r = rec({ country, needs: ["remote"] });
    expect(r.plan).toBe("plus");
    expect(r.price).toEqual({ kind: "unpublished" });
  }
  expect(rec({ country: "tr" }).gaps).toContain("wiz.gap.tr");
  expect(rec({ country: "other", needs: ["fiscal"] }).gaps).toContain("wiz.gap.fiscalother");
});

test("honest gaps: appointments, online shop and unknown card providers say 'not yet'", () => {
  expect(rec({ needs: ["appointments"] }).gaps).toContain("wiz.gap.appointments");
  expect(rec({ needs: ["online"] }).gaps).toContain("wiz.gap.online");
  expect(rec({ card: "other" }).gaps).toContain("wiz.gap.cardother");
  expect(rec({}).gaps).toEqual([]);
});

test("plugins follow the card provider; hardware follows the last answer", () => {
  expect(rec({ card: "sumup" }).plugins).toEqual(["payment-sumup"]);
  expect(rec({ card: "stripe" }).plugins).toEqual(["payment-stripe"]);
  expect(rec({ card: "none" }).plugins).toEqual([]);
  expect(rec({ hardware: "need" }).hardware).toBe("need");
  expect(rec({ hardware: "have" }).hardware).toBe("have");
});

test("plan names are the current ones, never the retired Chain / Enterprise", () => {
  const names = R.PLAN_ORDER.map((p) => ctxName(p));
  for (const n of names) expect(n).not.toMatch(/^(Chain|Enterprise)$/);
  expect(names).toEqual(["Local", "Local Plus", "Shop", "Pro", "Multi-location", "Enterprise and chains"]);
});

test("tse is priced only from Shop up (Local and Local Plus bring their own)", () => {
  for (const [needs, sites, tse] of [[[], "one", 0], [["remote"], "one", 0], [["fiscal"], "one", 12], [[], "few", 12]]) {
    const r = rec({ country: "de", needs, sites });
    expect(r.price.tse ?? 0, JSON.stringify({ needs, sites })).toBe(tse);
  }
});

test("prices match ut-docs/reference/subscription-plans.md (UK and euro ladders)", () => {
  // Owner decision 2026-10-24 (ut-docs#4193): typed out here on purpose, independent of the data file.
  const ladder = { plus: 10, shop: 29, pro: 49, multi: 120, extraLocation: 33 };
  const annual = { plus: 8.33, shop: 24.17, pro: 40.83, multi: 100 };
  expect(R.PRICES.uk).toMatchObject({ currency: "GBP", ...ladder, annual });
  expect(R.PRICES.de).toMatchObject({ currency: "EUR", ...ladder, annual, tsePerMainTill: 12 });
  expect(R.PRICES.eu).toMatchObject({ currency: "EUR", ...ladder, annual });
  expect(R.MAX_LOCATIONS).toBe(10);
  expect(R.PRICES.eu.tsePerMainTill).toBe(0);
  expect(Object.keys(R.PRICES).sort()).toEqual(["de", "eu", "uk"]);
});

test("every price line says it excludes VAT, in every locale", () => {
  const dict = loadDict();
  const mark = { "en-gb": /excl\. VAT/, "de-de": /zzgl\. MwSt/, "tr-tr": /KDV hariç/, "zh-cn": /不含增值税/, "fa-ir": /بدون احتساب مالیات بر ارزش افزوده/ };
  for (const loc of Object.keys(mark)) for (const k of ["wiz.price.month", "wiz.price.multi", "wiz.price.tse"]) expect(dict[loc][k], `${loc} ${k}`).toMatch(mark[loc]);
});

test("every key the wizard can ask for exists in every locale, with placeholders intact", () => {
  const src = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
  const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  const dict = (0, eval)("(" + m[1] + ")");
  const keys = [...R.allKeys(), "wiz.step", "wiz.price.month", "wiz.price.tse", "wiz.price.multi", "wiz.price.annual", "wiz.price.free", "wiz.price.talk", "wiz.price.unpub", "wiz.price.pick"];
  for (const loc of Object.keys(dict)) {
    for (const k of keys) {
      expect(dict[loc][k], `${loc} ${k}`).toBeTruthy();
    }
    for (const k of Object.keys(dict["en-gb"]).filter((x) => x.startsWith("wiz."))) {
      const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      expect(ph(dict[loc][k]), `${loc} ${k} placeholders`).toBe(ph(dict["en-gb"][k]));
    }
  }
});

function loadDict() {
  const src = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
  const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  return (0, eval)("(" + m[1] + ")");
}

function ctxName(plan) {
  const src = fs.readFileSync(path.join(ROOT, "site/i18n.js"), "utf8");
  const m = src.match(/const I18N = (\{[\s\S]*?\});\s*\n\s*\(function/);
  return (0, eval)("(" + m[1] + ")")["en-gb"]["wiz.plan." + plan];
}
