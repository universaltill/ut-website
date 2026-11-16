// The published-locale list as the specs see it. Specs iterate THIS instead of a
// fixed set of five locales, so a language that ut-translations publishes is
// tested the day it appears (ADR-0177, ut-docs#5406). Same code as the build.
import { loadDicts, hasMachineLabel, myLocales, PAGES, SOURCE } from "../../scripts/lib/locales.mjs";

const data = loadDicts();
export const LIST = data.list;
export const LOCALE_INFO = data.locales;
export const LOCALES = data.locales.map((l) => l.url);
/** Complete dictionaries (English filled in for keys a locale does not ship); `_fb` lists those keys. */
export const I18N = data.dicts;
export const ENGLISH = data.english;
export const META = data.meta;
export const MY_SERVED = [...myLocales(data.list)];
export { PAGES, SOURCE };
export const infoOf = (url) => data.locales.find((l) => l.url === url);
export const isLabelled = (url) => hasMachineLabel(infoOf(url));
export const RTL = data.locales.filter((l) => l.dir === "rtl").map((l) => l.url);
/** A key this locale really translates (not an English fallback). */
export const translated = (locale, key) => locale !== SOURCE && !I18N[locale]._fb.includes(key);
/** Locales that ship their own text for `key`. */
export const localesWith = (key) => LOCALES.filter((l) => l !== SOURCE && translated(l, key));

/** The visible text of the element carrying data-i18n="key" in a raw HTML string (fallback span unwrapped). */
export function renderedText(html, key) {
  const m = html.match(new RegExp(`data-i18n(?:-html)?="${key.replace(/\./g, "\\.")}"[^>]*>([\\s\\S]*?)</(?:a|p|h1|h2|h3|span|summary|li|button|strong)>`));
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}
