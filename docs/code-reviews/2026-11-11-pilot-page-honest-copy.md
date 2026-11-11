# Pilot page: copy made true (owner decision 2026-11-11)

Shipped: /pilot no longer promises hardware. English now says free, remote
setup (catalogue import incl. from a previous till's backup file, product and
price check, short training call), no hardware supplied, data export, Germany
= shadow run (not yet certified for fiscal use, no TSE), UK can go live after
a short shadow run. dl.pilotlink dropped "white-glove". de-de, tr-tr, fa-ir
(RTL unchanged), zh-cn updated with build-time translations by the authoring
model; meta.pilot.desc and pilot.get.i1 were missing in those locales and are
added. New test in tests/pilot-page.spec.js fails if white-glove, on-site,
fiskaly or "AI" wording returns in any locale; the hardware wording guard
was English-only at first and is now per-locale (see independent review).

Findings: none blocking. No fiskaly/TSE-vendor name, no customer names, no AI
wording. en.meta.json: new legal-tier entries for hardware and Germany claims.
Verification: guard scripts, guard-i18n-meta, check-i18n-keys, Playwright
pilot/internal-links/untranslated-duplicates all green (one earlier flake in
untranslated-duplicates under concurrent runs, green on rerun and on main).
Review was done by the authoring agent inline (no separate-model subagent);
the PR reviewer should check translations. Pre-flight: n/a (copy only).
Expect rebase conflicts with #90/#91 in i18n files.

## Independent review (Opus, 2026-11-11)

Findings, all fixed in this PR:

- Blocking: the hardware guard only covered English. Now every locale asserts
  pilot.get.i2 has no hardware wording (incl. German "Hardware") and that
  pilot.where.de contains "TSE". Proven by restoring old de/tr/fa/zh strings:
  4 failures, then restored.
- Blocking: de-de used "Piloten" (aircraft pilots); now "Pilotbetriebe".
- Blocking: fa-ir pilot.where.de/uk reworded to "برنامهٔ آزمایشی".
- pilot.where.uk is now review "legal" in en.meta.json.
- pilot.ask.i2 ("before any go-live") aligned in de, tr, fa, zh.
- Stray comma removed from English pilot.where.uk.
- This record corrected: the guard did not catch hardware wording in all locales.
