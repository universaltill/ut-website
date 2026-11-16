// The published-locale list as the Astro pages see it (ADR-0177, ut-docs#5406).
// Everything locale-shaped on the site - which locales exist, their direction,
// the AI label, which legal pages may be translated, which locales my. serves -
// is read from i18n/published/locales.json here and nowhere else. No locale is
// named in code. The logic lives in scripts/lib/locales.mjs so the generator,
// the guards and the specs read it identically.
// @ts-ignore - plain ESM shared with the node scripts
import { loadDicts, myLocales, hasMachineLabel, legalApproved, bcp47Of, withdrawnUrls, SOURCE } from '../../scripts/lib/locales.mjs';

export interface LocaleInfo {
  url: string;
  bcp47: string;
  dir: 'ltr' | 'rtl';
  native_name: string;
  english_name: string;
  machine_label: boolean;
  human_reviewed: boolean;
  surfaces: any;
}

const data = loadDicts() as { list: any; english: Record<string, string>; meta: Record<string, any>; locales: any[]; dicts: Record<string, Record<string, any>> };

export const SOURCE_LOCALE: string = SOURCE;
export const LOCALE_INFO: LocaleInfo[] = data.locales.map((l: any) => ({ ...l, bcp47: bcp47Of(l), machine_label: hasMachineLabel(l) }));
export const LANGS: string[] = LOCALE_INFO.map((l) => l.url);
export const I18N: Record<string, Record<string, any>> = data.dicts;
export const ENGLISH: Record<string, string> = data.english;
export const WITHDRAWN: string[] = withdrawnUrls(data.list);
const MY: Set<string> = myLocales(data.list);

export const infoOf = (url: string): LocaleInfo => LOCALE_INFO.find((l) => l.url === url) ?? LOCALE_INFO.find((l) => l.url === SOURCE)!;
export const dirOf = (url: string): 'ltr' | 'rtl' => infoOf(url).dir;
export const isMachineLabelled = (url: string): boolean => infoOf(url).machine_label;
/** The my. link uses the site locale iff my. serves it (cloud.manage published), else en-gb. */
export const myLocaleFor = (url: string): string => (MY.has(url) ? url : SOURCE);
/** A locale's translated legal document may be served only when the list approves it. */
export const legalApprovedFor = (url: string, doc: string): boolean => legalApproved(data.locales.find((l: any) => l.url === url), doc);
/** Keys a locale shows in English. */
export const fallbackKeys = (url: string): string[] => (I18N[url]?._fb ?? []) as string[];
