import rss from '@astrojs/rss';
import { LANGS } from '../../../layouts/BaseLayout.astro';
import { getLocalizedPosts } from '../../../lib/blogPosts';

// One feed per locale (/en-gb/blog/rss.xml, /tr-tr/blog/rss.xml, ...),
// matching every other blog surface's per-locale URL convention rather than
// a single English-only feed — the same reasoning BaseLayout's hreflang
// alternates and this site's canonical URLs already follow.
export function getStaticPaths() {
  return LANGS.map((lang) => ({ params: { lang } }));
}

// Plain English across every locale, same precedent blog/index.astro's own
// <title> already sets (its "News" <title> isn't translated either) —
// this card is plumbing, not the translation generator (ut-docs#475).
const TITLE = 'Universal Till News';
const DESCRIPTION = 'Release notes, roadmap updates and stories from shops running Universal Till.';

export async function GET(context) {
  const { lang } = context.params;
  const posts = await getLocalizedPosts(lang);

  return rss({
    title: TITLE,
    description: DESCRIPTION,
    site: context.site,
    items: posts.map(({ post, slug }) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.date,
      author: post.data.author,
      link: `/${lang}/blog/${slug}`,
    })),
  });
}
