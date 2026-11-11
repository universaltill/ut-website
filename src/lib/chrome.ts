// Markup shared by the marketing prerender and BaseLayout: the one-per-page
// fallback note and the language picker (ADR-0177). No page, band or badge
// says a translation is machine-made (owner, 2026-11-11). All text
// comes from the page locale's own dictionary - core keys, so never English on
// a non-English page - and all of it is prerendered, so there is no layout
// shift and nothing depends on JavaScript. site/i18n.js builds the same note
// for the two cases a build cannot (the single 404 page, a client-side switch).
import { LOCALE_INFO } from './locales';

export const ORIGIN = 'https://www.universaltill.com';

export const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Dict = Record<string, any>;

/** The fallback note: shown once, only on a page that really contains English fallback text. */
export const fallbackNoteHtml = (d: Dict) =>
  `<div class="mt-band mt-band--note" role="note" data-fallback-note data-locale-bound><p class="mt-band__text">${esc(d['site.fallback_note'])}</p></div>`;

const CHECK =
  '<svg aria-hidden="true" focusable="false" width="14" height="14" viewBox="0 0 14 14"><path d="M2 7.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/** The language picker: ul > li > a, current one marked. */
export function languageGridHtml(current: string, d: Dict): string {
  const items = LOCALE_INFO.map((l) => {
    const isCurrent = l.url === current;
    const name = `<span class="locale-name"><bdi lang="${esc(l.bcp47)}">${esc(l.native_name)}</bdi>` +
      (isCurrent ? `<span class="locale-current">${CHECK}<span>${esc(d['language.current'])}</span></span>` : '') +
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
