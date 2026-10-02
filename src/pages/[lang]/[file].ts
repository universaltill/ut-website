// Emits dist/<locale>/<page>.html — one prerendered copy of each site/*.html
// marketing page per locale (ut-docs#3480). See src/lib/marketingPages.ts.
import type { APIRoute } from 'astro';
import { marketingRoutes, renderMarketingPage, type MarketingRoute } from '../../lib/marketingPages';

export function getStaticPaths() {
  const routes = marketingRoutes();
  return routes.map((route) => ({
    params: { lang: route.locale, file: route.file },
    props: { route, routes },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { route, routes } = props as { route: MarketingRoute; routes: MarketingRoute[] };
  return new Response(renderMarketingPage(route, routes), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
