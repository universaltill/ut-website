import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, SOURCE_LOCALE } from '../layouts/BaseLayout.astro';

export interface LocalizedLegalPage {
  page: CollectionEntry<'legal'>;
  slug: string;
  /** True when this locale has no translation yet and English is standing in. */
  isFallback: boolean;
}

const slugOf = (entry: CollectionEntry<'legal'>) => entry.id.split('/').slice(1).join('/');

/**
 * Every legal page (impressum, privacy, terms) in every locale, translated
 * where a translation exists and falling back to the English original where
 * it doesn't — mirrors src/lib/blogPosts.ts exactly, so "which legal pages
 * exist, in which locale" is decided in exactly one place and can't drift
 * from the sitemap or the page renderer the way header markup once did
 * (tests/site-consistency.spec.js).
 */
export async function getAllLocalizedLegalPages(): Promise<Record<string, LocalizedLegalPage[]>> {
  const all = await getCollection('legal');
  const slugs = [...new Set(all.map(slugOf))];

  const byLocale: Record<string, LocalizedLegalPage[]> = {};
  for (const lang of LANGS) {
    byLocale[lang] = slugs
      .map((slug) => {
        const translated = all.find((p) => p.id === `${lang}/${slug}`);
        const source = all.find((p) => p.id === `${SOURCE_LOCALE}/${slug}`);
        const page = translated ?? source;
        return page && { page, slug, isFallback: !translated && lang !== SOURCE_LOCALE };
      })
      .filter((x): x is LocalizedLegalPage => Boolean(x));
  }
  return byLocale;
}
