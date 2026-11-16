// universaltill.com "Find your setup" wizard (ut-docs#4193) — the rules.
//
// ONE data table decides the answer, so a rule can change without touching
// markup or the UI code (site/wizard.js). Pure and DOM-free: it is also loaded
// by tests/wizard-rules.spec.js in plain Node. A classic script (no import /
// export) like the rest of site/; it only sets window.UT_WIZARD_RULES.
//
// Nothing here talks to a network. The page itself sends and stores nothing.
// The one way the answers leave it is the visitor's own choice: the "Talk to
// us" mailto link carries them (talkBody below) into the visitor's own mail
// app, and nothing is sent unless they send that email (the
// lead-capture-with-consent slice is ut-docs#2550).
//
// Where each answer puts the shop on the plan ladder is DATA, not code:
// data/plan-wizard-rules.json (a byte-identical copy of ut-docs
// reference/plan-wizard-rules.json, ut-docs#4962), shipped to the page as
// site/plan-wizard-rules.js. This file keeps what is the site's own: the
// question list, the i18n key of each reason, the "not yet" lines, notes and
// plugins. Only rows with built:true raise the plan; a not-built row never
// does. Tills are never metered, so there is no till-count question.
//
// Plan names and prices: ut-docs/reference/subscription-plans.md ("Prices by
// country"). Names are the CURRENT ones — Local, Local Plus, Shop, Pro,
// Multi-location, Enterprise and chains (never the retired Chain / Enterprise).
// Prices exist for the UK, Germany and the eurozone only; every other country's
// figures are "pre-#838, not current" in that doc, so we show "not published
// yet" instead of inventing a number.
(function (root) {
  "use strict";

  // Question order = screen order. type "one" = pick one, "many" = tick any
  // (including none). i18n keys: wiz.q.<id>, wiz.q.<id>.hint, wiz.o.<id>.<opt>.
  var QUESTIONS = [
    { id: "biz", type: "one", options: ["cafe", "restaurant", "retail", "salon", "stall", "other"] },
    { id: "country", type: "one", options: ["uk", "de", "eu", "tr", "other"] },
    { id: "sites", type: "one", options: ["one", "few", "many", "huge"] },
    // People who sign in to my. besides the owner (not till staff): ut-docs#4962.
    { id: "people", type: "one", options: ["none", "upto2", "upto5", "more"] },
    // Grouped by topic: till, then online, then support (UX, ut-docs#4962).
    { id: "needs", type: "many", options: ["tables", "stock", "fiscal", "away", "remote", "online", "appointments", "roles", "archive", "accountant", "phone"] },
    { id: "card", type: "one", options: ["sumup", "stripe", "other", "none"] },
    { id: "hardware", type: "one", options: ["have", "need"] },
  ];

  // Cheapest to dearest. The winning plan is the highest one any rule asks for.
  var PLAN_ORDER = ["local", "plus", "shop", "pro", "multi", "enterprise"];

  // Monthly list prices come from ONE file: data/plan-prices.json (vendored
  // from ut-docs reference/plan-prices.json, CI-checked), shipped to the page as
  // site/plan-prices.js. No amount is typed in this file. extraLocation: price of
  // each location beyond the included ones (up to maxLocations). tsePerMainTill:
  // Germany only, from tseFromPlan up. annual = per month, billed yearly.
  var SRC = root.UT_PLAN_PRICES;
  if (!SRC) throw new Error("wizard-rules: plan-prices.js must load first");
  var PRICES = {};
  Object.keys(SRC.markets).forEach(function (m) {
    var mk = SRC.markets[m];
    var o = { currency: mk.currency, extraLocation: SRC.extraLocation.monthly, tsePerMainTill: mk.tsePerMainTill, tseMinMonths: mk.tseMinMonths || 0, annual: {} };
    PLAN_ORDER.forEach(function (p) {
      var pl = mk.plans[p];
      if (pl && pl.monthly > 0) { o[p] = pl.monthly; o.annual[p] = pl.annualPerMonth; }
    });
    PRICES[m] = o;
  });
  var INCLUDED_LOCATIONS = SRC.includedLocations;
  var TSE_FROM = SRC.markets.de.tseFromPlan;

  // Where each outcome sends the visitor. "download" = the free local app,
  // "cloud" = my.universaltill.com, "talk" = a person.
  var ROUTE_OF_PLAN = {
    local: "download", plus: "cloud", shop: "cloud", pro: "cloud", multi: "cloud", enterprise: "talk",
  };

  // A rule's `if` is an AND over its keys. Scalar answers (biz, country, sites,
  // people, card, hardware) match when the answer is in the list; `needs`
  // matches when ANY listed need was ticked; `plan` matches the final plan and
  // `onlyBy` the rules that put them there (notes only).
  //
  // The plan follows features that EXIST. Online ordering, booking-platform sync
  // (Booksy), accountant access, phone support and tills syncing away from the
  // shop are "Coming soon" in subscription-plans.md: they appear in GAPS and
  // never raise the plan or the price (built:false in the data). Fixed staff
  // roles are free; only custom roles are Pro.
  var WR = root.UT_PLAN_WIZARD_RULES;
  if (!WR) throw new Error("wizard-rules: plan-wizard-rules.js must load first");

  function fail(msg) { throw new Error("wizard-rules: " + msg); }

  // i18n reason line per BUILT data rule (key ids are this site's, not ut-docs').
  var REASON_OF_RULE = {
    huge: "wiz.r.huge", multi: "wiz.r.multi", "managed-fiscal": "wiz.r.defiscal",
    "members-2": "wiz.r.members2", "members-5": "wiz.r.members5", "members-50": "wiz.r.members50",
    roles: "wiz.r.roles", archive: "wiz.r.archive", remote: "wiz.r.remote",
    tables: "wiz.r.tables", stock: "wiz.r.stock",
  };

  // Honest "we don't do this yet" lines. Never promise a date. An entry with
  // `rule` takes its condition from that built:false data rule, so the line
  // appears exactly when the not-yet feature was asked for.
  var GAPS = [
    { id: "appointments", if: { needs: ["appointments"] }, text: "wiz.gap.appointments" },
    { id: "online", if: { needs: ["online"] }, text: "wiz.gap.online" },
    { id: "away", rule: "away", text: "wiz.gap.mobilesync" },
    { id: "accountant", rule: "accountant", text: "wiz.gap.accountant" },
    { id: "phone", rule: "phone", text: "wiz.gap.phone" },
    { id: "tr", if: { country: ["tr"] }, text: "wiz.gap.tr" },
    { id: "fiscal-other", if: { country: ["eu", "other"], needs: ["fiscal"] }, text: "wiz.gap.fiscalother" },
    { id: "card-other", if: { card: ["other"] }, text: "wiz.gap.cardother" },
  ];

  // Load-time checks: the data and this file must agree, or the page refuses to
  // load (so flipping `built` in ut-docs forces the matching copy change here).
  var ruleById = {};
  WR.rules.forEach(function (r) {
    ruleById[r.id] = r;
    if (PLAN_ORDER.indexOf(r.plan) === -1) fail("rule " + r.id + ": unknown plan " + r.plan);
    Object.keys(r.if).forEach(function (k) {
      var q = null;
      for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === k) q = QUESTIONS[i];
      if (!q) fail("rule " + r.id + ": unknown question " + k);
      r.if[k].forEach(function (o) {
        if (q.options.indexOf(o) === -1) fail("rule " + r.id + ": unknown option " + k + "=" + o);
      });
    });
    if (r.built === true && !REASON_OF_RULE[r.id]) fail("rule " + r.id + " is built but has no reason line");
    if (r.built !== true && REASON_OF_RULE[r.id]) fail("rule " + r.id + " is not built but has a reason line");
  });
  Object.keys(REASON_OF_RULE).forEach(function (id) {
    if (!ruleById[id]) fail("reason line for unknown rule " + id);
  });
  GAPS.forEach(function (g) {
    if (!g.rule) return;
    var r = ruleById[g.rule];
    if (!r) fail("not-yet line " + g.id + " names unknown rule " + g.rule);
    if (r.built === true) fail("not-yet line " + g.id + " names rule " + g.rule + ", which is built");
    g.if = r.if;
  });
  WR.rules.forEach(function (r) {
    if (r.built === true) return;
    var n = GAPS.filter(function (g) { return g.rule === r.id; }).length;
    if (n !== 1) fail("rule " + r.id + " is not built and needs exactly one not-yet line (has " + n + ")");
  });

  // PLAN_RULES: each says "this answer needs at least <plan>" and why; ONLY
  // built rules. With no rule matching, the plan stays Local (the free app).
  var PLAN_RULES = WR.rules.filter(function (r) { return r.built === true; }).map(function (r) {
    return { id: r.id, plan: r.plan, if: r.if, reason: REASON_OF_RULE[r.id] };
  });
  var COMING_RULES = WR.rules.filter(function (r) { return r.built !== true; });
  var MANAGED_FISCAL_MARKETS = WR.managedFiscalMarkets;

  // Plugin pages on this site (/<locale>/plugins/<slug>/): only plugins that
  // are published today.
  var PLUGINS = [
    { slug: "payment-sumup", if: { card: ["sumup"] } },
    { slug: "payment-stripe", if: { card: ["stripe"] } },
    { slug: "language-de", if: { country: ["de"] } },
  ];

  // Short extra lines: what the answer means for this shop.
  var NOTES = [
    { id: "biz-cafe", if: { biz: ["cafe"] }, text: "wiz.n.cafe" },
    { id: "biz-restaurant", if: { biz: ["restaurant"] }, text: "wiz.n.restaurant" },
    { id: "biz-retail", if: { biz: ["retail"] }, text: "wiz.n.retail" },
    { id: "biz-salon", if: { biz: ["salon"] }, text: "wiz.n.salon" },
    { id: "biz-stall", if: { biz: ["stall"] }, text: "wiz.n.stall" },
    { id: "uk-fiscal", if: { country: ["uk"], needs: ["fiscal"] }, text: "wiz.n.ukfiscal" },
    // Germany: a TSE is required by law whatever the till. Shown whenever the
    // visitor did not tick the fiscal need (the fiscal tick has its own notes).
    { id: "de-tse-law", if: { country: ["de"], noNeeds: ["fiscal"] }, text: "wiz.n.detsemin" },
    // Only when the German fiscal need ALONE put them on Shop (onlyBy): with
    // locations, people or roles pushing the plan up, Local would not fit anyway.
    { id: "de-own-device", if: { country: ["de"], needs: ["fiscal"], onlyBy: ["managed-fiscal"] }, text: "wiz.n.deowndevice" },
    { id: "card-none", if: { card: ["none"] }, text: "wiz.n.cardnone" },
  ];

  // drivers = ids of the rules that put the answers on the final plan.
  function matches(cond, a, plan, drivers) {
    for (var k in cond) {
      var want = cond[k];
      if (k === "needs") {
        var n = a.needs || [];
        var any = false;
        for (var i = 0; i < want.length; i++) if (n.indexOf(want[i]) !== -1) any = true;
        if (!any) return false;
      } else if (k === "noNeeds") {
        var have = a.needs || [];
        for (var j = 0; j < want.length; j++) if (have.indexOf(want[j]) !== -1) return false;
      } else if (k === "plan") {
        if (want.indexOf(plan) === -1) return false;
      } else if (k === "onlyBy") {
        var ds = drivers || [];
        if (!ds.length) return false;
        for (var m = 0; m < ds.length; m++) if (want.indexOf(ds[m]) === -1) return false;
      } else if (want.indexOf(a[k]) === -1) return false;
    }
    return true;
  }

  function rank(plan) { return PLAN_ORDER.indexOf(plan); }

  // answers: { biz, country, sites, needs: [..], card, hardware } — any may be
  // missing (a skipped question); missing answers simply match no rule.
  function recommend(answers) {
    var a = answers || {};
    var plan = "local";
    var i;
    for (i = 0; i < PLAN_RULES.length; i++) {
      var r = PLAN_RULES[i];
      if (matches(r.if, a, plan) && rank(r.plan) > rank(plan)) plan = r.plan;
    }
    var drivers = [];
    for (i = 0; i < PLAN_RULES.length; i++) {
      if (PLAN_RULES[i].plan === plan && matches(PLAN_RULES[i].if, a, plan)) drivers.push(PLAN_RULES[i].id);
    }
    var reasons = [];
    for (i = 0; i < PLAN_RULES.length; i++) {
      var p = PLAN_RULES[i];
      if (matches(p.if, a, plan, drivers)) reasons.push(p.reason);
    }
    // The free local app: always say why it is enough, then any need it covers.
    if (plan === "local") reasons.unshift("wiz.r.local");

    function pick(table, field) {
      var out = [];
      for (var j = 0; j < table.length; j++) if (matches(table[j].if, a, plan, drivers)) out.push(table[j][field]);
      return out;
    }

    var priceInfo = PRICES[a.country] || null;
    var price;
    if (plan === "local") price = { kind: "free" };
    else if (plan === "enterprise") price = { kind: "talk" };
    else if (!a.country) price = { kind: "pick" };
    else if (!priceInfo) price = { kind: "unpublished" };
    else {
      // Local and Local Plus bring their own TSE: the managed-TSE line starts at TSE_FROM (Shop).
      price = { kind: "monthly", currency: priceInfo.currency, monthly: priceInfo[plan], annual: priceInfo.annual[plan], tse: rank(plan) >= rank(TSE_FROM) ? priceInfo.tsePerMainTill : 0 };
      price.tseMinMonths = price.tse > 0 ? priceInfo.tseMinMonths : 0;
      if (plan === "multi") {
        price.extraLocation = priceInfo.extraLocation;
        price.includedLocations = INCLUDED_LOCATIONS;
        price.extra = a.sites === "many";
      }
    }

    return {
      plan: plan,
      route: ROUTE_OF_PLAN[plan],
      price: price,
      reasons: reasons,
      gaps: pick(GAPS, "text"),
      notes: pick(NOTES, "text"),
      plugins: pick(PLUGINS, "slug"),
      hardware: a.hardware === "need" ? "need" : "have",
    };
  }

  // Body of the "Talk to us" mailto (RFC 6068: CRLF line breaks), so support need
  // not ask the same questions again. Pure: `t` is the caller's translate
  // function (key -> string). Skipped questions and an empty `needs` are left
  // out. The last line is a language-neutral "ref:" code, plan last.
  function talkBody(answers, result, t) {
    var a = answers || {};
    var lines = [t("wiz.talk.intro")];
    var refs = [];
    QUESTIONS.forEach(function (q) {
      var label;
      if (q.type === "many") {
        var have = Array.isArray(a[q.id]) ? a[q.id] : [];
        var picked = q.options.filter(function (o) { return have.indexOf(o) !== -1; });
        if (!picked.length) return;
        label = picked.map(function (o) { return t("wiz.o." + q.id + "." + o); }).join(", ");
        refs.push(q.id + "=" + picked.join(","));
      } else {
        if (q.options.indexOf(a[q.id]) === -1) return;
        label = t("wiz.o." + q.id + "." + a[q.id]);
        refs.push(q.id + "=" + a[q.id]);
      }
      lines.push(t("wiz.q." + q.id) + ": " + label);
    });
    lines.push(t("wiz.talk.plan") + ": " + t("wiz.plan." + result.plan));
    refs.push("plan=" + result.plan);
    lines.push("", "ref: " + refs.join("; "));
    return lines.join("\r\n");
  }

  // Outlook/Windows cut a mailto off around 2 KB, and the ref line is last, so
  // it would be lost first. Over TALK_MAX the body falls back to intro, plan
  // and the ref line (ASCII apart from intro and plan, so it always fits).
  var TALK_MAX = 1800;
  function talkHref(base, answers, result, t) {
    var href = base + "&body=" + encodeURIComponent(talkBody(answers, result, t));
    if (href.length <= TALK_MAX) return href;
    var full = talkBody(answers, result, t).split("\r\n");
    var short = [full[0], full[full.length - 3], "", full[full.length - 1]];
    return base + "&body=" + encodeURIComponent(short.join("\r\n"));
  }

  // Every i18n key the UI can ask for, so tests can prove each locale has them.
  function allKeys() {
    var keys = [];
    QUESTIONS.forEach(function (q) {
      keys.push("wiz.q." + q.id, "wiz.q." + q.id + ".hint");
      q.options.forEach(function (o) { keys.push("wiz.o." + q.id + "." + o); });
    });
    PLAN_ORDER.forEach(function (p) { keys.push("wiz.plan." + p); });
    keys.push("wiz.r.local"); // the plain Local reason, added by recommend()
    PLAN_RULES.forEach(function (r) { keys.push(r.reason); });
    GAPS.forEach(function (g) { keys.push(g.text); });
    NOTES.forEach(function (n) { keys.push(n.text); });
    PLUGINS.forEach(function (p) { keys.push("wiz.plugin." + p.slug); });
    keys.push("wiz.talk.subject", "wiz.talk.intro", "wiz.talk.plan", "wiz.talk.note");
    return keys;
  }

  root.UT_WIZARD_RULES = {
    QUESTIONS: QUESTIONS, PLAN_ORDER: PLAN_ORDER, PRICES: PRICES, MAX_LOCATIONS: SRC.extraLocation.maxLocations, ROUTE_OF_PLAN: ROUTE_OF_PLAN,
    PLAN_RULES: PLAN_RULES, COMING_RULES: COMING_RULES, MANAGED_FISCAL_MARKETS: MANAGED_FISCAL_MARKETS, REASON_OF_RULE: REASON_OF_RULE, GAPS: GAPS, PLUGINS: PLUGINS, NOTES: NOTES,
    recommend: recommend, talkBody: talkBody, talkHref: talkHref, TALK_MAX: TALK_MAX, allKeys: allKeys,
  };
})(typeof window !== "undefined" ? window : globalThis);
