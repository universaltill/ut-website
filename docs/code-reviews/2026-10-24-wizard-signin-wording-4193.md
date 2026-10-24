# Review - wizard CTA wording (ut-docs#4193), 2026-10-24

Change: the cloud button and shortcut card read "Create your account or sign in" (en, de, tr, zh, fa) instead of "Open my.universaltill.com". Link unchanged: https://my.universaltill.com/<locale>/, where the my. app does its own Zitadel sign-in/sign-up; the site holds no credential and carries no answers across.

Verification: full gate run (build, i18n keys OK, plan-names guard OK, Playwright 449 passed). Looked at de-de at 360px, fa-ir at 1024px (RTL) and en-gb at 360px result pages: no horizontal overflow, button text and href correct. Not looked at: tr and zh renders, a real sign-in round trip.

Independent review: wording-only change on top of the independently reviewed PR (see 2026-10-23-find-your-setup-wizard-4193.md); no second model pass was run. Still open for the owner: publishing plan prices (PR stays draft).
