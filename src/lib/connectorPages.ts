import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, SOURCE_LOCALE } from '../layouts/BaseLayout.astro';

export interface LocalizedConnectorPage {
  page: CollectionEntry<'connector'>;
  slug: string;
  /** True when this locale has no translation yet and English is standing in. */
  isFallback: boolean;
}

const slugOf = (entry: CollectionEntry<'connector'>) => entry.id.split('/').slice(1).join('/');

/**
 * Every connector page in every locale, translated
 * where a translation exists and falling back to the English original where
 * it doesn't — mirrors src/lib/blogPosts.ts exactly, so "which connector pages
 * exist, in which locale" is decided in exactly one place and can't drift
 * from the sitemap or the page renderer the way header markup once did
 * (tests/site-consistency.spec.js).
 */
export async function getAllLocalizedConnectorPages(): Promise<Record<string, LocalizedConnectorPage[]>> {
  const all = await getCollection('connector');
  const slugs = [...new Set(all.map(slugOf))];

  const byLocale: Record<string, LocalizedConnectorPage[]> = {};
  for (const lang of LANGS) {
    byLocale[lang] = slugs
      .map((slug) => {
        const translated = all.find((p) => p.id === `${lang}/${slug}`);
        const source = all.find((p) => p.id === `${SOURCE_LOCALE}/${slug}`);
        const page = translated ?? source;
        return page && { page, slug, isFallback: !translated && lang !== SOURCE_LOCALE };
      })
      .filter((x): x is LocalizedConnectorPage => Boolean(x));
  }
  return byLocale;
}

/**
 * The locales with a real translation of one connector page — its hreflang set.
 * A fallback locale is left out of it and out of the sitemap, and its
 * canonical points at the English original (ut-docs#3811): five URLs of the
 * same English text otherwise read to Google as duplicates.
 */
export function translatedLangsOf(byLocale: Record<string, LocalizedConnectorPage[]>, slug: string): string[] {
  return LANGS.filter((lang) => (byLocale[lang] ?? []).some((p) => p.slug === slug && !p.isFallback));
}
