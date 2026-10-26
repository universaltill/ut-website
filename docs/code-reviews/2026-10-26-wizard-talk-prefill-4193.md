# Review - wizard "Talk to us" carries the answers (ut-docs#4193), 2026-10-26

**Change.** The "Find your setup" result's "Talk to us" links now open
`mailto:support@universaltill.com?subject=…&body=…`. The body holds:
- an intro line;
- one `question: answer` line per answered question, in the visitor's language;
- the suggested plan;
- a language-neutral `ref: biz=…; country=…; …; plan=…` line.

This way support doesn't have to ask the visitor the same questions again.

The code is a pure `talkBody` / `talkHref` in `site/wizard-rules.js`, called from `site/wizard.js`. A new line under the buttons (`wiz.talk.note`) says the email goes only if the visitor sends it. The page itself still stores and sends nothing. The copy that promised "your answers stay in this browser" is reworded in all 5 locales: `wiz.res.sent`, `wiz.privacy`, `meta.find-your-setup.desc` and the static fallbacks in `find-your-setup.html`. Strings were translated in en/tr/zh/fa/de.

**Independent review** (Opus 5.5; the code was built by Sonnet 5.5):
- **Major, fixed:** the result screen and meta description still said the answers "stay in this browser", next to a button that emails them.
- **Minor, fixed:** a worst-case fa-ir href reached about 3.2 KB. Outlook/Windows cut mailto at about 2 KB, so the `ref:` line would be lost. Fix: `talkHref` falls back to intro + plan + `ref:` above 1800 characters.
- **Minor, fixed:** tests now cover the enterprise (talk) route's primary button, and edit-then-redraw.
- **Nit, fixed:** the `needs` handling uses options order, removes duplicates, and guards against a non-array value.
- **Nit, fixed:** quoting in the en note; smoother fa wording.
- **Checked and fine:** no XSS (`textContent` only, href is a fixed prefix plus `encodeURIComponent`), RTL-neutral CSS, translations consistent with each locale's existing CTA and title.

**Verification:**
- The full Playwright suite passed: 518 passed. `check-i18n-keys`, `guard-compliance-claims`, `guard-plan-names`, `guard-plan-prices`, `generate-csp --check` and `check-documented-paths` are all OK.
- TDD re-verified by the orchestrator. With `talkHref` reverted to a bare mailto and the length cap removed, 7 tests fail. Restored, 81/81 pass.
- I looked at the result screen at en-gb 1024×600, and at fa-ir (RTL) and de-de at 360px: no horizontal overflow, and the note is readable under the buttons.
- **Not checked:** tr-tr and zh-cn renders; a real Outlook/Windows mail client opening the link.

**Legal.** The site privacy policy's "Emailing us" section already covers any email the visitor sends us ("that email (or any other email to us)"). Naming the wizard there is follow-up ut-docs#5031, which needs the owner's OK on live legal text.

**Verdict:** safe to merge.

**Deferred** (separate cards): routing "talk to us" to the shop's country partner (#4190 / #4205), lead capture with consent (#2550), instant browser start (#4191).
