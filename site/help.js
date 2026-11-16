// Progressive-enhancement filter for /<locale>/help/ (ut-docs#5355). With JS
// off the whole list is on the page and the search form stays hidden; this
// file reveals it and filters the cards by title + summary + keywords (the
// data-search attribute), hides sections left empty, announces the count in an
// aria-live region and clears on Escape. An external script, never inline, so
// the CSP needs no new hash.
(function () {
  var form = document.querySelector('form.help-search');
  if (!form) return;
  var input = form.querySelector('input[type="search"]');
  var status = form.querySelector('.help-count');
  var items = Array.prototype.slice.call(document.querySelectorAll('.help-item'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.help-section'));
  if (!input || !items.length) return;

  function norm(s) {
    s = String(s || '').toLowerCase();
    if (s.normalize) s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    return s;
  }
  var hay = items.map(function (li) { return norm(li.getAttribute('data-search')); });

  var clear = form.querySelector('.help-clear');
  var total = items.length;

  function say(n, q) {
    if (!status) return;
    var t;
    if (n === 0) t = (form.getAttribute('data-none') || '').replace('{q}', function () { return q; });
    else if (n === total) t = (form.getAttribute('data-count') || '').replace('{total}', function () { return String(total); });
    else t = (form.getAttribute('data-filtered') || '').replace('{n}', function () { return String(n); }).replace('{total}', function () { return String(total); });
    status.textContent = t;
    if (clear) clear.hidden = !q;
  }

  function apply() {
    var tokens = norm(input.value).split(/\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (li, i) {
      var ok = tokens.every(function (t) { return hay[i].indexOf(t) !== -1; });
      li.hidden = !ok;
      if (ok) shown++;
    });
    sections.forEach(function (sec) {
      sec.hidden = !sec.querySelector('.help-item:not([hidden])');
    });
    say(shown, input.value.trim());
  }

  form.hidden = false;
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  input.addEventListener('input', apply);
  if (clear) clear.addEventListener('click', function () { input.value = ''; apply(); input.focus(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      apply();
    }
  });
  apply();
})();
