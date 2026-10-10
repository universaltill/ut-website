import { bcp47 } from '../layouts/BaseLayout.astro';

/**
 * A date in the reader's own language and calendar (ut-docs#3805: these were
 * hard-coded en-GB, so /de-de/ showed "7 October 2026"). fa-IR resolves to the
 * Solar Hijri calendar in Persian digits — Iran's civil calendar, intended.
 *
 * `timeZone: 'UTC'` matters: frontmatter dates parse as UTC midnight, and a
 * build server in a negative-offset TZ would otherwise print the previous day.
 */
export const formatDate = (date: Date, locale: string): string =>
  new Intl.DateTimeFormat(bcp47(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
