import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { getProductHeading, getProducts } from '@/lib/mock-ai-products';
import { baseLocale } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

const STATIC_PAGES: { path: string; title: string; description: string }[] = [
  {
    path: '',
    title: 'AI tools directory',
    description:
      'Trending AI tools by category, each with what it does and how to use it',
  },
  {
    path: '/products',
    title: 'All AI tools',
    description:
      'The full AI tools list, searchable and filterable by category',
  },
  {
    path: '/channels',
    title: 'AI-generated TV channels',
    description: 'Live AI TV channels and AI streamers you can watch now',
  },
  {
    path: '/real-time',
    title: 'Real-time AI video',
    description: 'How live AI video generation works',
  },
  {
    path: '/submit',
    title: 'Submit an AI tool',
    description: 'Suggest a tool for the directory',
  },
];

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const { app_url, app_name, app_description } = envConfigs;

        let posts = getLocalPosts(baseLocale);
        try {
          const { listPublishedArticles } =
            await import('@/modules/posts/service');
          const rows = await listPublishedArticles().catch(() => []);
          const dbPosts = rows.map((row) => ({
            slug: row.slug,
            title: row.title || row.slug,
            description: row.description || '',
            createdAt: new Date(row.createdAt).toISOString(),
            source: 'db' as const,
          }));
          posts = mergePosts(dbPosts, posts);
        } catch {
          // Database unreachable — local posts still listed.
        }

        const lines: string[] = [
          `# ${app_name}`,
          '',
          `> ${app_description}`,
          '',
          '## Pages',
          '',
          ...STATIC_PAGES.map(
            (p) => `- [${p.title}](${app_url}${p.path}): ${p.description}`
          ),
        ];

        lines.push('', '## AI tools', '');
        for (const product of getProducts('en')) {
          lines.push(
            `- [${getProductHeading(product)}](${app_url}/products/${product.slug}): ${product.tagline}`
          );
        }

        if (posts.length > 0) {
          lines.push('', '## Blog Posts', '');
          for (const post of posts) {
            lines.push(
              `- [${post.title}](${app_url}/blog/${post.slug}): ${post.description}`
            );
          }
        }

        lines.push('');

        return new Response(lines.join('\n'), {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      },
    },
  },
});
