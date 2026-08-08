import { getCollection, type CollectionEntry } from 'astro:content';
import { LANGS, SOURCE_LOCALE } from '../layouts/BaseLayout.astro';

export interface LocalizedPost {
  post: CollectionEntry<'blog'>;
  slug: string;
  /** True when this locale has no translation yet and English is standing in. */
  isFallback: boolean;
}

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
        return post && { post, slug, isFallback: !translated && lang !== SOURCE_LOCALE };
      })
      .filter((x): x is LocalizedPost => Boolean(x))
      .sort((a, b) => b.post.data.date.getTime() - a.post.data.date.getTime());
  }
  return byLocale;
}

/** Posts for a single locale, English-fallback applied, newest first. */
export async function getLocalizedPosts(lang: string): Promise<LocalizedPost[]> {
  const all = await getAllLocalizedPosts();
  return all[lang] ?? [];
}
