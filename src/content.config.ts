import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    excerpt: z.string(),
    author: z.string().default('Universal Till'),
    coverImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
