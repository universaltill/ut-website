// Universal Till website i18n: logic only. Text nodes carry data-i18n keys;
// this swaps them and sets dir for right-to-left languages. The strings and the
// list of languages are NOT here: they come from site/i18n-data.js, generated
// by scripts/gen-locales.mjs from the published-locale list (ADR-0177,
// ut-docs#5406). Adding a language = it appears in that list; no edit here.
const I18N = (window.UT_I18N_DATA && window.UT_I18N_DATA.locales) || {};

(function () {
  const supported = Object.keys(I18N);
  // Keys a locale shows in English (not translated or not approved yet): they
  // are wrapped lang="en" data-i18n-fallback so assistive tech and CSS know.
  function fallbackSet(dict) {
    if (!dict._fbset) { dict._fbset = {}; (dict._fb || []).forEach(function (k) { dict._fbset[k] = true; }); }
    return dict._fbset;
  }
  // Write a dictionary value into an element. A fallback value goes into an
  // English-language span so a Persian or Arabic page does not read English as
  // its own language.
  function put(el, key, dict, asHtml) {
    const v = dict[key];
    if (v == null) return;
    if (fallbackSet(dict)[key] && el.tagName !== "TITLE") {
      const span = document.createElement("span");
      span.setAttribute("lang", "en");
      span.setAttribute("dir", "ltr");
      span.setAttribute("data-i18n-fallback", "");
      if (asHtml) span.innerHTML = v; else span.textContent = v;
      el.textContent = "";
      el.appendChild(span);
    } else if (asHtml) el.innerHTML = v;
    else el.textContent = v;
  }
  // EVERY locale is in the URL, English included. Leaving the default
  // unprefixed looks tidier and is a bug: with English at "/", choosing
  // English after Turkish navigates to a URL that says nothing about
  // language, `pick()` falls back to the stored preference, and the page
  // comes back in Turkish. The URL has to carry the answer.
  const DEFAULT = (window.UT_I18N_DATA && window.UT_I18N_DATA.DEFAULT) || "en-gb";
  // BCP-47 wants the region subtag uppercased ("en-GB"). Browsers and crawlers
  // treat it case-insensitively, but the <html lang> and hreflang values are
  // read by people too, and lowercase looks like a typo.
  function bcp47(code) {
    if (I18N[code] && I18N[code]._bcp47) return I18N[code]._bcp47;
    const parts = code.split("-");
    return parts.length === 2 ? parts[0] + "-" + parts[1].toUpperCase() : code;
  }
  const ORIGIN = "https://www.universaltill.com";
  // Each language has its own URL path (/tr, /zh, /fa; English at root) so
  // crawlers index a distinct, hreflang-linked page per language.
  function langFromPath() {
    const seg = (location.pathname.split("/").filter(Boolean)[0] || "").toLowerCase();
    return supported.includes(seg) ? seg : null;
  }
  // Strip a leading /tr|/zh|/fa so a path can be re-prefixed with another
  // language. "/tr/blog" -> "/blog", "/tr" -> "/".
  function stripLang(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length && supported.includes(parts[0].toLowerCase())) parts.shift();
    // Keep a trailing slash: the Astro pages' canonical form is /blog/ and the
    // slashless URL is a duplicate (ut-docs#3798).
    const slash = parts.length && pathname.endsWith("/") ? "/" : "";
    return "/" + parts.join("/") + slash;
  }
  // The language prefix IS the URL, for every page — not just the homepage.
  // Anything else means the Turkish version of a page has no address a search
  // engine can index or a visitor can bookmark.
  function pathFor(lang, path) {
    const p = path || "/";
    return p === "/" ? "/" + lang : "/" + lang + p;
  }
  // `from` arrives in a query string, so treat it as untrusted: same-origin
  // absolute paths only. "//evil.example" is a protocol-relative URL, not a
  // path, and would make the language picker an open redirect.
  function sanitizeFrom(value) {
    if (!value || value[0] !== "/" || value[1] === "/" || value.indexOf("\\") !== -1) return "/";
    return value;
  }
  function pick() {
    // Path first, always: it is the only source the visitor can see, share or
    // bookmark, and the only one that can override a stale stored choice.
    const p = langFromPath();
    if (p) return p;
    const saved = localStorage.getItem("ut_lang");
    if (saved && supported.includes(saved)) return saved;
    // Match the browser's full locale first (en-GB beats en-US beats en), then
    // fall back to any locale sharing its base language — a Turkish speaker in
    // Germany sends "tr-DE" and should still get Turkish, not English.
    const nav = (navigator.language || DEFAULT).toLowerCase();
    if (supported.includes(nav)) return nav;
    const base = nav.split("-")[0];
    const sameLanguage = supported.find(function (code) { return code.split("-")[0] === base; });
    return sameLanguage || DEFAULT;
  }
  // Same markup as src/lib/chrome.ts (the build's copy of it).
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function band(lang, dict) {
    const b = el("div", "mt-band");
    b.setAttribute("role", "note"); b.setAttribute("data-mt-band", ""); b.setAttribute("data-locale-bound", "");
    const p = el("p", "mt-band__text");
    p.appendChild(el("strong", null, dict["site.machine_label"]));
    p.appendChild(document.createTextNode(" "));
    p.appendChild(el("span", null, dict["site.machine_label_detail"]));
    const links = el("p", "mt-band__links");
    const en = el("a", null, dict["site.machine_label_link"]);
    en.setAttribute("href", pathFor(DEFAULT, stripLang(location.pathname))); en.setAttribute("hreflang", "en-GB");
    const rep = el("a", null, dict["site.machine_label_report"]);
    rep.setAttribute("href", "mailto:support@universaltill.com?subject=" + encodeURIComponent("Translation error (" + lang + ")") + "&body=" + encodeURIComponent("Page: " + ORIGIN + pathFor(lang, stripLang(location.pathname)) + "\nWhat reads wrongly:\n"));
    [en, rep].forEach(function (a) { const w = document.createElement("bdi"); w.appendChild(a); links.appendChild(w); });
    b.appendChild(p); b.appendChild(links);
    return b;
  }
  function note(dict) {
    const n = el("div", "mt-band mt-band--note");
    n.setAttribute("role", "note"); n.setAttribute("data-fallback-note", ""); n.setAttribute("data-locale-bound", "");
    n.appendChild(el("p", "mt-band__text", dict["site.fallback_note"]));
    return n;
  }
  function apply(lang) {
    const dict = I18N[lang];
    // The language the page showed until now — the build's locale on first
    // load, so nothing is rewritten then (see the link loop below).
    const shown = (document.documentElement.lang || "").toLowerCase();
    document.documentElement.lang = bcp47(lang);
    document.documentElement.dir = dict._dir || "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      put(el, el.getAttribute("data-i18n"), dict, false);
    });
    // data-i18n-html: same lookup, but for the rare string that legitimately
    // carries markup (e.g. inline <code>/<strong> around command names) —
    // textContent would print the tags as literal text instead of rendering
    // them. Values come from translators now, so gen-locales.mjs rejects any
    // value outside a small tag allow-list or whose tags/links differ from the
    // English text before this file can be generated.
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      put(el, el.getAttribute("data-i18n-html"), dict, true);
    });
    // Same lookup for aria-label: assistive tech announces whatever's in the
    // attribute, so an untranslated aria-label is just as much an English
    // leak as untranslated visible text (ut-docs#467).
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      const v = dict[el.getAttribute("data-i18n-aria-label")];
      if (v != null) el.setAttribute("aria-label", v);
    });
    // Same again for <img alt>: a screenshot's alt text is read aloud in
    // place of the image, so it must follow the page language too.
    document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
      const v = dict[el.getAttribute("data-i18n-alt")];
      if (v != null) el.setAttribute("alt", v);
    });
    // <meta name="description"> carries its text in `content` (ut-docs#3480);
    // the build prerenders it per locale, this keeps a client-side language
    // switch consistent with that.
    document.querySelectorAll("[data-i18n-content]").forEach(function (el) {
      const v = dict[el.getAttribute("data-i18n-content")];
      if (v != null) el.setAttribute("content", v);
    });
    // Nav shows a single compact link to /language instead of an inline
    // dropdown — lots of languages don't fit a nav bar, see language.html.
    document.querySelectorAll(".lang-link").forEach(function (a) {
      a.textContent = "🌐 " + lang.toUpperCase();
      // The accessible name must contain the visible text (WCAG 2.5.3,
      // Lighthouse label-content-name-mismatch — ut-docs#3493): "DE-DE —
      // Sprache", not a bare "Sprache" that voice control can't match.
      a.setAttribute("aria-label", lang.toUpperCase() + " — " + dict["nav.language"]);
      // Carry the current page to /language, or picking a language drops the
      // visitor on the homepage and they have to find their way back — which
      // is what happened from /blog. On /language itself, keep whatever the
      // previous page already passed rather than pointing back at /language.
      const here = stripLang(location.pathname);
      const from = here === "/language"
        ? sanitizeFrom(new URLSearchParams(location.search).get("from"))
        : here;
      a.setAttribute("href", pathFor(lang, "/language") + "?from=" + encodeURIComponent(from));
    });
    // Same-site links carry a locale prefix from the build (ut-docs#3798);
    // after a language switch without a reload (go() below) the ones in the
    // previous language must follow the visible one, or the next click lands
    // back in it. Links deliberately in another language (a post's "Read the
    // English original") are left alone.
    if (shown !== lang && supported.includes(shown)) {
      document.querySelectorAll('a[href^="/' + shown + '"]').forEach(function (a) {
        if (a.classList.contains("lang-link")) return;
        const href = a.getAttribute("href");
        if (/^\/[a-z]{2}-[a-z]{2}(?=[\/?#]|$)/.test(href)) a.setAttribute("href", "/" + lang + href.slice(shown.length + 1));
      });
    }
    // The AI band and fallback note are prerendered for the page's own
    // locale. A build cannot do it for the one 404 page that every locale
    // shares, nor after a client-side switch, so rebuild them here: drop the
    // ones bound to the previous locale, add this locale's.
    if (shown !== lang) {
      document.querySelectorAll("[data-locale-bound]").forEach(function (n) { n.remove(); });
      const header = document.querySelector("header.nav");
      if (header) {
        const frag = [];
        if (dict._label) frag.push(band(lang, dict));
        if (document.querySelector("[data-i18n-fallback]")) frag.push(note(dict));
        let at = header;
        frag.forEach(function (n) { at.insertAdjacentElement("afterend", n); at = n; });
      }
    }
    // Canonical points at THIS language's URL.
    const c = document.getElementById("canonical");
    if (c) c.setAttribute("href", ORIGIN + pathFor(lang, stripLang(location.pathname)));
    localStorage.setItem("ut_lang", lang);
  }
  function go(lang) {
    // Reflect the language in the URL (crawlable) without a reload.
    if (langFromPath() !== lang) {
      history.pushState({ lang: lang }, "", pathFor(lang, stripLang(location.pathname)));
    }
    apply(lang);
  }
  window.addEventListener("popstate", function () { apply(pick()); });
  document.addEventListener("DOMContentLoaded", function () {
    apply(pick());
  });
  // Exposed so language.html can list/highlight locales without duplicating
  // this logic — real <a href> navigation there, not a JS click handler.
  window.UT_I18N = {
    I18N: I18N, my: (window.UT_I18N_DATA && window.UT_I18N_DATA.my) || [], supported: supported, pick: pick, pathFor: pathFor, go: go,
    stripLang: stripLang, sanitizeFrom: sanitizeFrom, bcp47: bcp47, DEFAULT: DEFAULT,
  };
})();
