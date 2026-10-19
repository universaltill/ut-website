import type { APIRoute } from 'astro';
import { loadPlugins, type PluginAsset } from '../../../lib/plugins';

// Plugin logos and screenshots, copied from each plugin repo at build time and
// served from this site (ut-docs#4645), so the CSP's img-src stays 'self'.
// src/lib/plugins.ts only accepts PNG/JPEG/WebP, checked by magic bytes.
export async function getStaticPaths() {
  const plugins = await loadPlugins();
  return plugins.flatMap((p) =>
    [p.icon, ...p.screenshots]
      .filter((a): a is PluginAsset => a !== null)
      .map((asset) => ({ params: { slug: p.slug, file: asset.path.split('/').pop()! }, props: { asset } })),
  );
}

export const GET: APIRoute = ({ props }) => {
  const { asset } = props as { asset: PluginAsset };
  return new Response(asset.bytes, { headers: { 'Content-Type': asset.contentType } });
};
