// /<locale>/pricing: market picker (ut-docs#4963). The prices are already in
// the HTML (built from data/plan-prices.json); with JavaScript off every
// market panel is shown, one after the other. This only shows one panel at a
// time and lets the visitor switch. Stores nothing, sends nothing.
(function () {
  "use strict";
  var root = document.querySelector("[data-pricing]");
  if (!root) return;
  var panels = Array.prototype.slice.call(root.querySelectorAll("[data-market]"));
  var picker = root.querySelector("[data-picker]");
  if (!panels.length || !picker) return;
  var buttons = [];
  function show(id) {
    panels.forEach(function (p) { p.hidden = p.getAttribute("data-market") !== id; });
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-for") === id ? "true" : "false"); });
  }
  panels.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn price-pick";
    b.setAttribute("data-for", p.getAttribute("data-market"));
    b.textContent = p.getAttribute("data-market-label");
    b.addEventListener("click", function () { show(p.getAttribute("data-market")); });
    picker.appendChild(b);
    buttons.push(b);
  });
  picker.hidden = false;
  show(root.getAttribute("data-default-market") || panels[0].getAttribute("data-market"));
})();
