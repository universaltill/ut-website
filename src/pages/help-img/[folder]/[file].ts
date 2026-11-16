import type { APIRoute } from 'astro';
import { loadHelp } from '../../../lib/help';

// Help screenshots, copied from the product repo's web/help/img/ at build time
// and served from this site (ut-docs#5355), so the CSP's img-src stays 'self'.
// src/lib/help.ts only accepts PNGs under 1MB, checked by magic bytes; only
// the pictures a public topic actually shows are emitted.
export async function getStaticPaths() {
  const { imageFiles } = await loadHelp();
  return [...imageFiles].map(([served, bytes]) => {
    const [, , folder, file] = served.split('/');
    return { params: { folder, file }, props: { bytes } };
  });
}

export const GET: APIRoute = ({ props }) =>
  new Response((props as { bytes: Uint8Array }).bytes, { headers: { 'Content-Type': 'image/png' } });
