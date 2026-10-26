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
    { id: "needs", type: "many", options: ["tables", "stock", "online", "appointments", "fiscal", "remote", "team"] },
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
    var o = { currency: mk.currency, extraLocation: SRC.extraLocation.monthly, tsePerMainTill: mk.tsePerMainTill, annual: {} };
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
  // card, hardware) match when the answer is in the list; `needs` matches when
  // ANY listed need was ticked; `plan` matches the final plan (notes only).
  //
  // The plan follows features that EXIST. Online ordering, booking-platform sync
  // (Booksy), accountant access and phone support are "Coming soon" in
  // subscription-plans.md: they appear in GAPS and never raise the plan or the
  // price. (Fixed staff roles are free; only custom roles are Pro.)
  //
  // PLAN_RULES: each says "this answer needs at least <plan>" and why. With no
  // rule matching, the plan stays Local (the free app).
  var PLAN_RULES = [
    { id: "huge", plan: "enterprise", if: { sites: ["huge"] }, reason: "wiz.r.huge" },
    { id: "multi", plan: "multi", if: { sites: ["few", "many"] }, reason: "wiz.r.multi" },
    { id: "de-fiscal", plan: "shop", if: { country: ["de"], needs: ["fiscal"] }, reason: "wiz.r.defiscal" },
    { id: "remote", plan: "plus", if: { needs: ["remote"] }, reason: "wiz.r.remote" },
    { id: "tables", plan: "local", if: { needs: ["tables"] }, reason: "wiz.r.tables" },
    { id: "stock", plan: "local", if: { needs: ["stock"] }, reason: "wiz.r.stock" },
  ];

  // Honest "we don't do this yet" lines. Never promise a date.
  var GAPS = [
    { id: "appointments", if: { needs: ["appointments"] }, text: "wiz.gap.appointments" },
    { id: "online", if: { needs: ["online"] }, text: "wiz.gap.online" },
    { id: "team", if: { needs: ["team"] }, text: "wiz.gap.team" },
    { id: "tr", if: { country: ["tr"] }, text: "wiz.gap.tr" },
    { id: "fiscal-other", if: { country: ["eu", "other"], needs: ["fiscal"] }, text: "wiz.gap.fiscalother" },
    { id: "card-other", if: { card: ["other"] }, text: "wiz.gap.cardother" },
  ];

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
    { id: "de-tse-law", if: { country: ["de"], noNeeds: ["fiscal"] }, text: "wiz.n.detse" },
    // Only when the German fiscal need ALONE put them on Shop. With sites
    // pushing the plan to Multi-location or beyond, Local would not fit anyway.
    { id: "de-own-device", if: { country: ["de"], needs: ["fiscal"], plan: ["shop"] }, text: "wiz.n.deowndevice" },
    { id: "card-none", if: { card: ["none"] }, text: "wiz.n.cardnone" },
  ];

  function matches(cond, a, plan) {
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
    var reasons = [];
    for (i = 0; i < PLAN_RULES.length; i++) {
      var p = PLAN_RULES[i];
      if (matches(p.if, a, plan)) reasons.push(p.reason);
    }
    // The free local app: always say why it is enough, then any need it covers.
    if (plan === "local") reasons.unshift("wiz.r.local");

    function pick(table, field) {
      var out = [];
      for (var j = 0; j < table.length; j++) if (matches(table[j].if, a, plan)) out.push(table[j][field]);
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
    PLAN_RULES: PLAN_RULES, GAPS: GAPS, PLUGINS: PLUGINS, NOTES: NOTES,
    recommend: recommend, talkBody: talkBody, talkHref: talkHref, TALK_MAX: TALK_MAX, allKeys: allKeys,
  };
})(typeof window !== "undefined" ? window : globalThis);
