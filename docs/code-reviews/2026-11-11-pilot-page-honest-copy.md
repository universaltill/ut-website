# Pilot page: copy made true (owner decision 2026-11-11)

Shipped: /pilot no longer promises hardware. English now says free, remote
setup (catalogue import incl. from a previous till's backup file, product and
price check, short training call), no hardware supplied, data export, Germany
= shadow run (not yet certified for fiscal use, no TSE), UK can go live after
a short shadow run. dl.pilotlink dropped "white-glove". de-de, tr-tr, fa-ir
(RTL unchanged), zh-cn updated with build-time translations by the authoring
model; meta.pilot.desc and pilot.get.i1 were missing in those locales and are
added. New test in tests/pilot-page.spec.js fails if hardware, white-glove,
on-site, fiskaly or "AI" wording returns.

Findings: none blocking. No fiskaly/TSE-vendor name, no customer names, no AI
wording. en.meta.json: new legal-tier entries for hardware and Germany claims.
Verification: guard scripts, guard-i18n-meta, check-i18n-keys, Playwright
pilot/internal-links/untranslated-duplicates all green (one earlier flake in
untranslated-duplicates under concurrent runs, green on rerun and on main).
Review was done by the authoring agent inline (no separate-model subagent);
the PR reviewer should check translations. Pre-flight: n/a (copy only).
Expect rebase conflicts with #90/#91 in i18n files.
