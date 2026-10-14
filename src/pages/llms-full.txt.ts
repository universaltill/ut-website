import type { APIRoute } from 'astro';
import { llmsFullTxt } from '../lib/llmsText';

// ut-docs#4319 — see src/lib/llmsText.ts.
export const GET: APIRoute = async () =>
  new Response(await llmsFullTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
