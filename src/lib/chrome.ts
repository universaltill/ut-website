// Markup shared by the marketing prerender and BaseLayout: the "translated
// with AI" band, the one-per-page fallback note, the footer report link and
// the language picker (ADR-0177, UX spec 2026-11-04, ut-docs#5406). All text
// comes from the page locale's own dictionary - core keys, so never English on
// a non-English page - and all of it is prerendered, so there is no layout
// shift and nothing depends on JavaScript. site/i18n.js builds the same band
// for the two cases a build cannot (the single 404 page, a client-side switch).
import { LOCALE_INFO, SOURCE_LOCALE } from './locales';

export const ORIGIN = 'https://www.universaltill.com';
export const SUPPORT_MAIL = 'support@universaltill.com';

export const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Dict = Record<string, any>;

/** mailto: with the locale and page filled in. */
export function reportHref(locale: string, pageUrl: string): string {
  const subject = `Translation error (${locale})`;
  const body = `Page: ${pageUrl}\nWhat reads wrongly:\n`;
  return `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const AI_ICON =
  '<svg class="mt-band__icon" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="10" y="14" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" font-family="system-ui,sans-serif">AI</text></svg>';

/**
 * The AI band. `path` is the page path without the locale ("/download",
 * "/legal/terms/", "" for home); the English link goes to the same page under
 * en-gb. Call only for a machine-labelled locale.
 */
export function bandHtml(locale: string, path: string, d: Dict): string {
  const en = `/${SOURCE_LOCALE}${path || ''}`;
  const here = `${ORIGIN}/${locale}${path || ''}`;
  return (
    `<div class="mt-band" role="note" data-mt-band data-locale-bound>` +
    AI_ICON +
    `<p class="mt-band__text"><strong>${esc(d['site.machine_label'])}</strong> <span>${esc(d['site.machine_label_detail'])}</span></p>` +
    `<p class="mt-band__links">` +
    `<bdi><a href="${esc(en)}" hreflang="en-GB">${esc(d['site.machine_label_link'])}</a></bdi>` +
    `<bdi><a href="${esc(reportHref(locale, here))}">${esc(d['site.machine_label_report'])}</a></bdi>` +
    `</p></div>`
  );
}

/** The fallback note: shown once, only on a page that really contains English fallback text. */
export const fallbackNoteHtml = (d: Dict) =>
  `<div class="mt-band mt-band--note" role="note" data-fallback-note data-locale-bound><p class="mt-band__text">${esc(d['site.fallback_note'])}</p></div>`;

/** Footer line with the report link (the band scrolls away, the footer keeps the promise). */
export const footerReportHtml = (locale: string, path: string, d: Dict) =>
  `<p class="foot-report" data-locale-bound><a href="${esc(reportHref(locale, `${ORIGIN}/${locale}${path || ''}`))}">${esc(d['site.machine_label_report'])}</a></p>`;

const CHECK =
  '<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** The language picker: ul > li > a, current one marked, AI badge on unreviewed locales. */
export function languageGridHtml(current: string, d: Dict): string {
  const items = LOCALE_INFO.map((l) => {
    const isCurrent = l.url === current;
    const name = `<span class="locale-name"><bdi lang="${esc(l.bcp47)}">${esc(l.native_name)}</bdi>` +
      (isCurrent ? `<span class="locale-current">${CHECK}<span>${esc(d['language.current'])}</span></span>` : '') +
      (l.machine_label ? `<span class="mt-badge" aria-hidden="true">${esc(d['site.machine_label_badge'])}</span><span class="sr-only">${esc(d['site.machine_label'])}</span>` : '') +
      `</span>`;
    return (
      `<li><a class="locale-card${isCurrent ? ' active' : ''}" href="/${esc(l.url)}" hreflang="${esc(l.bcp47)}" data-code="${esc(l.url)}"${isCurrent ? ' aria-current="true"' : ''}>` +
      name +
      `<span class="locale-english" lang="en" dir="ltr">${esc(l.english_name)}</span>` +
      `<span class="locale-code">${esc(l.url.toUpperCase())}</span></a></li>`
    );
  });
  return `<ul class="locale-grid" id="locale-grid" aria-labelledby="language-title">${items.join('')}</ul>`;
}
