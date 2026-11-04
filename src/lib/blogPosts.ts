import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, SOURCE_LOCALE, isMachineLabelled } from './locales';

export interface LocalizedPost {
  post: CollectionEntry<'blog'>;
  slug: string;
  /** True when this locale has no translation yet and English is standing in. */
  isFallback: boolean;
  /** A real translation search engines may index. A machine translation in a
   *  locale with no recorded human review is noindex with the canonical on the
   *  English original unless the post itself is marked `reviewed` (ADR-0177 s7). */
  indexable: boolean;
}

/** Whether a (translated) post of `lang` may be indexed. English always may. */
export const isIndexableTranslation = (post: CollectionEntry<'blog'>, lang: string): boolean =>
  lang === SOURCE_LOCALE || !post.data.machineTranslated || !isMachineLabelled(lang) || post.data.reviewed === true;

const slugOf = (entry: CollectionEntry<'blog'>) => entry.id.split('/').slice(1).join('/');

/**
 * Every published post in every locale, translated where a translation
 * exists and falling back to the English original where it doesn't — never
 * a shorter blog in one language than another. Shared by the blog index,
 * sitemap.xml and each locale's rss.xml so "which posts exist, in which
 * locale" is decided in exactly one place.
 */
export async function getAllLocalizedPosts(): Promise<Record<string, LocalizedPost[]>> {
  const all = await getCollection('blog', ({ data }) => !data.draft);
  const slugs = [...new Set(all.map(slugOf))];

  const byLocale: Record<string, LocalizedPost[]> = {};
  for (const lang of LANGS) {
    byLocale[lang] = slugs
      .map((slug) => {
        const translated = all.find((p) => p.id === `${lang}/${slug}`);
        const source = all.find((p) => p.id === `${SOURCE_LOCALE}/${slug}`);
        const post = translated ?? source;
        return post && { post, slug, isFallback: !translated && lang !== SOURCE_LOCALE, indexable: !translated || isIndexableTranslation(translated, lang) };
      })
      .filter((x): x is LocalizedPost => Boolean(x))
      .sort((a, b) => b.post.data.date.getTime() - a.post.data.date.getTime());
  }
  return byLocale;
}

/**
 * The locales with a real translation of one post — its hreflang set. Same
 * rule as src/lib/legalPages.ts's translatedLangsOf (ut-docs#3811): a
 * fallback locale is left out of hreflang and the sitemap, and its canonical
 * points at the English original.
 */
export function translatedLangsOf(byLocale: Record<string, LocalizedPost[]>, slug: string): string[] {
  return LANGS.filter((lang) => (byLocale[lang] ?? []).some((p) => p.slug === slug && !p.isFallback && p.indexable));
}

/** Posts for a single locale, English-fallback applied, newest first. */
export async function getLocalizedPosts(lang: string): Promise<LocalizedPost[]> {
  const all = await getAllLocalizedPosts();
  return all[lang] ?? [];
}
