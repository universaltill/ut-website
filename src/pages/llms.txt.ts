import type { APIRoute } from 'astro';
import { llmsTxt } from '../lib/llmsText';

// ut-docs#4319 — see src/lib/llmsText.ts.
export const GET: APIRoute = async () =>
  new Response(await llmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
