// universaltill.com — mobile nav (hamburger) toggle.
// Vanilla, no dependencies. Mirrors the plain-IIFE style of site/i18n.js.
//
// Behaviour (ut-docs#458):
//  - toggles a .nav-open class on the ancestor .nav, which the CSS uses to
//    show/hide the #site-nav dropdown panel at <=560px;
//  - flips aria-expanded / aria-label on the toggle button so assistive
//    tech tracks open/closed state;
//  - closes on: clicking a link inside #site-nav, pressing Escape (focus
//    returns to the toggle button), or clicking outside the open panel.
//
// No focus trap: the toggle is a real <button> (natively focusable and
// activatable) and the panel is a simple top-down dropdown, not a modal —
// Escape + outside-click + returning focus to the toggle is a documented,
// deliberate choice, not an oversight (ut-docs#458 AC2).
(function () {
  function closeMenu(nav, toggle) {
    nav.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Menu");
  }

  function openMenu(nav, toggle, panel) {
    nav.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    // The toggle sits after #site-nav in DOM order (it's visually below the
    // header but the panel it reveals is earlier in source), so a keyboard
    // user pressing Enter/Space on the toggle would otherwise Tab straight
    // past the newly-revealed links into page content. Move focus to the
    // first link so Tab order actually follows what's now on screen.
    const firstLink = panel.querySelector("a");
    if (firstLink) firstLink.focus();
  }

  function wire(toggle) {
    const nav = toggle.closest(".nav");
    if (!nav) return;
    const panel = document.getElementById(toggle.getAttribute("aria-controls")) || nav.querySelector("nav");
    if (!panel) return;

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (nav.classList.contains("nav-open")) {
        closeMenu(nav, toggle);
      } else {
        openMenu(nav, toggle, panel);
      }
    });

    // A viewport resize past the mobile breakpoint while the menu is open
    // leaves .nav-open / aria-expanded="true" on a now-hidden toggle —
    // harmless visually (the desktop CSS wins) but assistive tech querying
    // the toggle would report it as expanded. Keep the two in sync.
    var mq = window.matchMedia("(max-width: 560px)");
    var onMqChange = function (e) {
      if (!e.matches) closeMenu(nav, toggle);
    };
    if (mq.addEventListener) mq.addEventListener("change", onMqChange);
    else mq.addListener(onMqChange); // Safari < 14

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu(nav, toggle);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("nav-open")) {
        closeMenu(nav, toggle);
        toggle.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("nav-open")) return;
      if (nav.contains(e.target)) return;
      closeMenu(nav, toggle);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".nav-toggle").forEach(wire);
  });
})();
