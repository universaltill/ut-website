// Cookie consent + Google Analytics 4 (ut-docs#3507). Loaded `defer` right
// after i18n.js on every page.
//
// Nothing talks to Google until the visitor presses Accept (UK PECR reg. 6,
// ePrivacy art. 5(3)): gtag.js is injected only then — "basic" consent mode,
// not "advanced", which would send cookieless pings before any choice. The
// choice lives in localStorage (`ut_consent` = granted|denied), never in a
// cookie, so asking sets nothing either.
//
// The banner and the footer "Cookie settings" button are built here rather
// than written into every page: six site/*.html pages and BaseLayout.astro
// would otherwise carry seven copies of the same markup. Both use data-i18n
// keys, and this file runs before DOMContentLoaded, so i18n.js translates
// them along with the rest of the page (and again on a language switch).
// External file, so the CSP needs no new script hash.
(function () {
  "use strict";
  var GA_ID = "G-6WZY1CZ94Q";
  var KEY = "ut_consent";
  // Ask again after a year: consent is not forever (ICO; EDPB/DSK expect a
  // refresh within 6–12 months).
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var loaded = false;
  var opener = null;

  // Stored as "granted|<ms>" / "denied|<ms>". Anything else, or older than
  // MAX_AGE_MS, counts as no choice and the banner asks again.
  function stored() {
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    var m = /^(granted|denied)\|(\d+)$/.exec(raw || "");
    if (!m || Date.now() - Number(m[2]) > MAX_AGE_MS) return null;
    return m[1];
  }
  function store(v) {
    try { localStorage.setItem(KEY, v + "|" + Date.now()); } catch (e) { /* private mode: ask again next page */ }
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function loadAnalytics() {
    window["ga-disable-" + GA_ID] = false;
    if (loaded) {
      // Accept again after a Reject on this same page.
      gtag("consent", "update", { analytics_storage: "granted" });
      return;
    }
    loaded = true;
    gtag("consent", "default", {
      ad_storage: "denied", ad_user_data: "denied",
      ad_personalization: "denied", analytics_storage: "denied",
    });
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("js", new Date());
    gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  // Withdrawal: tell an already-running gtag to stop, and delete the cookies
  // it set. GA4 writes them on the widest domain it can (".universaltill.com"),
  // so try every parent domain of this host as well as host-only.
  // The consent update alone would leave a loaded gtag.js sending cookieless
  // pings (scrolls, outbound clicks); ga-disable-<id> is Google's documented
  // switch that stops it sending anything.
  function withdraw() {
    window["ga-disable-" + GA_ID] = true;
    if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
    var names = document.cookie.split(";").map(function (c) { return c.split("=")[0].trim(); })
      .filter(function (n) { return n === "_ga" || n.indexOf("_ga_") === 0 || n === "_gid"; });
    var parts = location.hostname.split(".");
    var domains = [""];
    for (var i = 0; i < parts.length - 1; i++) domains.push("; domain=." + parts.slice(i).join("."));
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }

  function locale() {
    var i = window.UT_I18N;
    return i ? i.pick() : "en-gb";
  }

  var banner = document.createElement("section");
  banner.id = "consent-banner";
  banner.className = "consent";
  banner.setAttribute("aria-label", "Cookies");
  banner.setAttribute("data-i18n-aria-label", "consent.label");
  banner.hidden = true;
  banner.innerHTML =
    '<p class="consent-text"><span data-i18n="consent.text">We\'d like to use Google Analytics cookies to see how visitors use this site. Nothing is set unless you accept.</span> ' +
    '<a class="consent-privacy" data-i18n="consent.privacy">Privacy policy</a></p>' +
    '<div class="consent-actions">' +
    '<button type="button" class="btn" data-consent="granted" data-i18n="consent.accept">Accept</button>' +
    '<button type="button" class="btn" data-consent="denied" data-i18n="consent.reject">Reject</button>' +
    "</div>";
  banner.querySelector(".consent-privacy").setAttribute("href", "/" + locale() + "/legal/privacy");
  banner.addEventListener("click", function (e) {
    var b = e.target.closest("[data-consent]");
    if (!b) return;
    var v = b.getAttribute("data-consent");
    store(v);
    banner.hidden = true;
    if (v === "granted") loadAnalytics(); else withdraw();
    // Reopened from the footer: give focus back rather than drop it on <body>.
    if (opener) { opener.focus(); opener = null; }
  });
  document.body.appendChild(banner);

  var legal = document.querySelector(".foot-legal");
  if (legal) {
    var open = document.createElement("button");
    open.type = "button";
    open.className = "link-btn";
    open.setAttribute("data-consent-open", "");
    open.setAttribute("data-i18n", "foot.cookies");
    open.textContent = "Cookie settings";
    open.addEventListener("click", function () {
      opener = open;
      banner.hidden = false;
      banner.querySelector("[data-consent]").focus();
    });
    legal.appendChild(document.createTextNode(" · "));
    legal.appendChild(open);
  }

  var choice = stored();
  if (choice === "granted") loadAnalytics();
  else if (choice !== "denied") banner.hidden = false;
})();
