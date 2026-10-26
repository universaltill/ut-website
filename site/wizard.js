// universaltill.com "Find your setup" wizard UI (ut-docs#4193).
//
// Vanilla, no dependencies, plain classic script like nav.js. The decisions
// live in site/wizard-rules.js (one data table, unit-tested); this file only
// draws questions, remembers the answers IN MEMORY and draws the answer.
//
// Privacy: the page itself never stores the answers (no localStorage / cookie
// / URL), never sends them (no fetch / XHR / beacon / form post) and never logs
// them. They live in a local variable until the tab closes. The one exception
// is the visitor's own action: the "Talk to us" mailto link carries the answers
// into the visitor's own mail app, and nothing is sent unless they send that
// email. Lead capture with consent is a later slice (ut-docs#2550).
//
// Progressive enhancement: with JS off the page still shows the two plain links
// ("Download the free app" / "Open my.universaltill.com") from the HTML.
(function () {
  "use strict";
  var host = document.getElementById("wiz");
  var R = window.UT_WIZARD_RULES;
  var U = window.UT_I18N;
  if (!host || !R || !U) return;

  var lang = U.pick();
  var dict = U.I18N[lang] || U.I18N[U.DEFAULT];
  function t(key) { var v = dict[key]; return v != null ? v : key; }
  function fill(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(href, text, cls) {
    var a = el("a", cls, text);
    a.setAttribute("href", href);
    return a;
  }

  // my.universaltill.com serves only these locales (ut-my-shop/src/i18n/i18n.ts);
  // a visitor on any other site language (zh-cn) lands on its en-gb tree.
  var MY_LOCALES = ["en-gb", "en-us", "de-de", "es-es", "fr-fr", "it-it", "pt-pt", "tr-tr", "ar-sa", "fa-ir"];
  var MY = "https://my.universaltill.com/" + (MY_LOCALES.indexOf(lang) !== -1 ? lang : "en-gb") + "/";
  var DOWNLOAD = "/" + lang + "/download";
  var TALK_BASE = "mailto:support@universaltill.com?subject=" + encodeURIComponent(t("wiz.talk.subject"));
  var TALK = TALK_BASE; // redrawn with the answers when the result is drawn

  // The no-JS cloud link carries the build's locale; keep it on the visible one.
  Array.prototype.forEach.call(document.querySelectorAll("a[data-my-link]"), function (a) { a.setAttribute("href", MY); });

  var answers = { needs: [] };
  var step = 0;
  var moved = false; // only steal focus after the visitor acted, never on load

  // Digits follow the surrounding text: Persian digits in fa, Latin elsewhere.
  function numLocale() { return lang === "fa-ir" ? U.bcp47(lang) + "-u-nu-arabext" : U.bcp47(lang) + "-u-nu-latn"; }
  function num(n) {
    try { return new Intl.NumberFormat(numLocale()).format(n); } catch (e) { return String(n); }
  }
  // Whole amounts show no decimals; 24.17 keeps its cents.
  function money(currency, amount) {
    try {
      var frac = Math.round(amount) === amount ? 0 : 2;
      return new Intl.NumberFormat(numLocale(), { style: "currency", currency: currency, minimumFractionDigits: frac, maximumFractionDigits: frac }).format(amount);
    } catch (e) {
      return amount + " " + currency;
    }
  }

  function clear() { while (host.firstChild) host.removeChild(host.firstChild); }
  function focusHeading(node) {
    if (!moved) return;
    node.setAttribute("tabindex", "-1");
    node.focus({ preventScroll: false });
  }

  function renderQuestion() {
    var qs = R.QUESTIONS;
    var q = qs[step];
    clear();
    var form = el("form", "wiz-form");
    form.setAttribute("novalidate", "");

    var prog = el("div", "wiz-progress");
    var label = el("p", "wiz-step", fill(t("wiz.step"), { n: step + 1, total: qs.length }));
    var bar = el("div", "wiz-bar");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", t("wiz.progress"));
    bar.setAttribute("aria-valuemin", "1");
    bar.setAttribute("aria-valuemax", String(qs.length));
    bar.setAttribute("aria-valuenow", String(step + 1));
    var fillEl = el("span", "wiz-bar-fill");
    fillEl.style.width = ((step + 1) / qs.length * 100) + "%";
    bar.appendChild(fillEl);
    prog.appendChild(label);
    prog.appendChild(bar);
    form.appendChild(prog);

    var fs = el("fieldset", "wiz-fs");
    var legend = el("legend", "wiz-legend", t("wiz.q." + q.id));
    fs.appendChild(legend);
    var hint = el("p", "wiz-hint", t("wiz.q." + q.id + ".hint"));
    hint.id = "wiz-hint-" + q.id;
    fs.setAttribute("aria-describedby", hint.id);
    fs.appendChild(hint);

    var many = q.type === "many";
    var opts = el("div", "wiz-opts");
    q.options.forEach(function (o) {
      var id = "wiz-" + q.id + "-" + o;
      var lab = el("label", "wiz-opt");
      lab.setAttribute("for", id);
      var inp = el("input");
      inp.type = many ? "checkbox" : "radio";
      inp.name = q.id;
      inp.value = o;
      inp.id = id;
      inp.checked = many ? answers.needs.indexOf(o) !== -1 : answers[q.id] === o;
      lab.appendChild(inp);
      lab.appendChild(el("span", "wiz-opt-text", t("wiz.o." + q.id + "." + o)));
      opts.appendChild(lab);
    });
    fs.appendChild(opts);
    fs.appendChild(el("p", "wiz-skip", t("wiz.skiphint")));
    form.appendChild(fs);

    var actions = el("div", "wiz-actions");
    if (step > 0) {
      var back = el("button", "btn wiz-btn", t("wiz.back"));
      back.type = "button";
      back.addEventListener("click", function () { save(form, q); step--; moved = true; renderQuestion(); });
      actions.appendChild(back);
    }
    var next = el("button", "btn primary wiz-btn", t(step === qs.length - 1 ? "wiz.finish" : "wiz.next"));
    next.type = "submit";
    actions.appendChild(next);
    form.appendChild(actions);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      save(form, q);
      moved = true;
      if (step === qs.length - 1) renderResult();
      else { step++; renderQuestion(); }
    });
    host.appendChild(form);
    legend.setAttribute("tabindex", "-1");
    if (moved) legend.focus();
    announce(label.textContent + ". " + legend.textContent);
  }

  // Polite live region, outside the redrawn form so it survives every step.
  var live = el("div", "sr-only");
  live.setAttribute("aria-live", "polite");
  live.setAttribute("role", "status");
  if (host.parentNode) host.parentNode.insertBefore(live, host);
  function announce(msg) {
    // Only after the visitor acted: nothing is read out on page load.
    if (moved) live.textContent = msg;
  }

  function save(form, q) {
    var chosen = [];
    Array.prototype.forEach.call(form.querySelectorAll("input"), function (i) { if (i.checked) chosen.push(i.value); });
    if (q.type === "many") answers.needs = chosen;
    else if (chosen.length) answers[q.id] = chosen[0];
    else delete answers[q.id];
  }

  function section(titleKey) {
    var s = el("section", "wiz-sec");
    s.appendChild(el("h3", "wiz-sec-title", t(titleKey)));
    return s;
  }
  function list(keys, cls) {
    var ul = el("ul", cls || "wiz-list");
    var vars = { tse: money(R.PRICES.de.currency, R.PRICES.de.tsePerMainTill) };
    keys.forEach(function (k) { ul.appendChild(el("li", null, fill(t(k), vars))); });
    return ul;
  }

  function priceLines(r) {
    var p = r.price;
    var lines = [];
    if (p.kind === "free") lines.push(t("wiz.price.free"));
    else if (p.kind === "talk") lines.push(t("wiz.price.talk"));
    else if (p.kind === "pick") lines.push(t("wiz.price.pick"));
    else if (p.kind === "unpublished") lines.push(t("wiz.price.unpub"));
    else {
      lines.push(fill(t("wiz.price.month"), { price: money(p.currency, p.monthly) }));
      if (p.annual) lines.push(fill(t("wiz.price.annual"), { price: money(p.currency, p.annual) }));
      if (p.extraLocation) lines.push(fill(t("wiz.price.multi"), { price: money(p.currency, p.extraLocation), included: num(p.includedLocations), max: num(R.MAX_LOCATIONS) }));
      if (p.tse) lines.push(fill(t("wiz.price.tse"), { price: money(p.currency, p.tse) }));
    }
    return lines;
  }

  function renderResult() {
    var r = R.recommend(answers);
    TALK = R.talkHref(TALK_BASE, answers, r, t);
    clear();
    var box = el("div", "wiz-result");
    box.setAttribute("data-plan", r.plan);
    box.setAttribute("data-route", r.route);

    var kicker = el("p", "wiz-kicker", t("wiz.res.title"));
    var title = el("h2", "wiz-plan", t("wiz.plan." + r.plan));
    box.appendChild(kicker);
    box.appendChild(title);
    var prices = el("div", "wiz-price");
    priceLines(r).forEach(function (l, i) { prices.appendChild(el("p", i === 0 ? "wiz-price-main" : "wiz-price-sub", l)); });
    box.appendChild(prices);

    // Next step first: the whole point is getting them to the right place.
    var next = section("wiz.res.next");
    var cta = el("div", "wiz-cta");
    if (r.route === "download") cta.appendChild(link(DOWNLOAD, t("wiz.cta.download"), "btn primary big wiz-go"));
    else if (r.route === "cloud") {
      cta.appendChild(link(MY, t("wiz.cta.cloud"), "btn primary big wiz-go"));
      cta.appendChild(link(DOWNLOAD, t("wiz.cta.startfree"), "btn big"));
    } else {
      cta.appendChild(link(TALK, t("wiz.cta.talk"), "btn primary big wiz-go"));
      cta.appendChild(link(DOWNLOAD, t("wiz.cta.download"), "btn big"));
    }
    if (r.route !== "talk") cta.appendChild(link(TALK, t("wiz.cta.talk"), "btn big"));
    next.appendChild(cta);
    next.appendChild(el("p", "wiz-note", t("wiz.talk.note")));
    box.appendChild(next);

    var why = section("wiz.res.why");
    why.appendChild(list(r.reasons));
    box.appendChild(why);

    var hw = section("wiz.res.hw");
    hw.appendChild(el("p", null, t(r.hardware === "need" ? "wiz.hw.need" : "wiz.hw.have")));
    var hwl = el("p", "wiz-links");
    hwl.appendChild(link("/" + lang + "/start", t("wiz.hw.devices")));
    hwl.appendChild(link("/" + lang + "/android-till", t("wiz.hw.android")));
    hw.appendChild(hwl);
    box.appendChild(hw);

    var pl = section("wiz.res.plugins");
    if (r.plugins.length) {
      var ul = el("ul", "wiz-list");
      r.plugins.forEach(function (slug) {
        var li = el("li");
        li.appendChild(link("/" + lang + "/plugins/" + slug + "/", t("wiz.plugin." + slug)));
        ul.appendChild(li);
      });
      pl.appendChild(ul);
    } else pl.appendChild(el("p", null, t("wiz.res.plugins.none")));
    var all = el("p", "wiz-links");
    all.appendChild(link("/" + lang + "/plugins/", t("wiz.res.plugins.all")));
    pl.appendChild(all);
    box.appendChild(pl);

    if (r.notes.length) {
      var nt = section("wiz.res.notes");
      nt.appendChild(list(r.notes));
      box.appendChild(nt);
    }
    if (r.gaps.length) {
      // Text label as well as a border: never colour alone.
      var gp = section("wiz.res.gaps");
      gp.className += " wiz-gaps";
      gp.appendChild(list(r.gaps));
      box.appendChild(gp);
    }

    var guide = section("wiz.res.guide");
    var gl = el("p", "wiz-links");
    gl.appendChild(link("/" + lang + "/start", t("wiz.res.guide.link")));
    guide.appendChild(gl);
    box.appendChild(guide);

    box.appendChild(el("p", "wiz-sent", t("wiz.res.sent")));

    var actions = el("div", "wiz-actions");
    var edit = el("button", "btn wiz-btn", t("wiz.edit"));
    edit.type = "button";
    edit.addEventListener("click", function () { step = 0; renderQuestion(); });
    var again = el("button", "btn wiz-btn", t("wiz.restart"));
    again.type = "button";
    again.addEventListener("click", function () { answers = { needs: [] }; step = 0; renderQuestion(); });
    actions.appendChild(edit);
    actions.appendChild(again);
    box.appendChild(actions);

    host.appendChild(box);
    focusHeading(title);
    announce(t("wiz.res.title") + ": " + t("wiz.plan." + r.plan));
  }

  renderQuestion();
})();
