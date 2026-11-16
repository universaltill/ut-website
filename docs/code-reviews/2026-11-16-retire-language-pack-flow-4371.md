# Retire the language-pack flow (ut-docs#4371)

**What:** ADR-0160 section 9.3, owner rule "no leftovers". German, Spanish and Portuguese now ship as Weblate bundles (`com.universaltill.language-*`); the hand-made `ut-plugin-language-*` repos are archived. This repo drops its references to them.

**Change:** Removed the two ut-plugin-language-* entries from src/lib/plugin-list.json and the language-de entry from site/wizard-rules.js PLUGINS; the wizard spec now asserts it is absent. wiz.plugin.language-de i18n key left (Weblate-synced files; unused key is harmless).

**Review:** self-review of the diff against the Architect design (WP-C); the pack-name grep is empty outside historical review records.
