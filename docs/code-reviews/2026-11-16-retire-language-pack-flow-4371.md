# Retire the language-pack flow (ut-docs#4371)

**What:** ADR-0160 section 9.3, owner rule "no leftovers". German, Spanish and Portuguese now ship as Weblate bundles (`com.universaltill.language-*`); the hand-made `ut-plugin-language-*` repos are archived. This repo drops its references to them.

**Change:** Removed the two ut-plugin-language-* entries from src/lib/plugin-list.json and the language-de entry from site/wizard-rules.js PLUGINS; the wizard spec now asserts it is absent. The now-unused wiz.plugin.language-de key is removed from en.json, en.meta.json, the locale files and site/i18n-data.js (Tester finding, commit 24c0e4a).

**Review:** self-review of the diff against the Architect design (WP-C); the pack-name grep is empty outside historical review records.

## Reviewer

Reviewed for ut-docs#4371 (combined batch), Opus 5.5. Diff read in full: the two plugin-list entries, the wizard `PLUGINS` entry and its key are gone, and the spec now asserts `language-de` is absent (not just dropped). No other `language-(de|es|pt)` or `/plugins/language-` reference in the repo. The old `/<locale>/plugins/language-de/` pages 404 with no redirect, per the no-leftovers rule. Only fix: this record still said the key was kept; corrected. Verdict: approve.
