// In-app legal view (ut-docs#6398): keep links to other legal pages inside the
// chrome-less /app/legal/ view, so no menu with Pricing is one tap away.
// External file because the site CSP allows no inline script.
document.querySelectorAll("article[data-app-legal] a[href*='/legal/']").forEach(function (a) {
  var h = a.getAttribute("href");
  if (h && h.charAt(0) === "/" && h.indexOf("/app/legal/") === -1) a.setAttribute("href", h.replace("/legal/", "/app/legal/"));
});
