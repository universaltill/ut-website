// Site locales with NO public help pages (ut-docs#5355 owner decision, #6948):
// /<locale>/help/ and /<locale>/help/<slug>/ are not built, are not in the
// sitemap, the locale's Help links go to the English help instead, and its
// old help URLs 301 to /en-gb/help/ (scripts/lib/locales.mjs localeRoutes).
// Plain ESM so the Astro code (src/lib/helpLocales.ts), the generator and
// scripts/guard-help.mjs read the same list. Matches ut-cloud's
// helpdocs.PublicURL (empty for ar).
export const HELP_UNPUBLISHED = ["ar-sa"];

/** Does this site locale get its own /<locale>/help/ pages? */
export const hasHelp = (locale) => !HELP_UNPUBLISHED.includes(locale);

/** The locale whose help a `locale` page should link to. */
export const helpLocaleFor = (locale) => (hasHelp(locale) ? locale : "en-gb");
