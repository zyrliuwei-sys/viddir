import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { listPublishedProductSubmissions } from '@/modules/product-submissions/service';
import { getProducts } from '@/lib/mock-ai-products';
import { getChannelsData, seoPageLocales } from '@/lib/seo-content';
import { baseLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { getLocalPosts, mergePosts } from '@/content/posts';

/**
 * Static pages and the locales each one has real copy for. Topic pages are
 * English-only (their /zh URL canonicalizes to English), so only the English
 * URL is listed. Template pages (/pricing, empty /blog) are left out.
 */
const STATIC_PAGES: { path: string; locales: readonly string[] }[] = [
  { path: '/', locales: seoPageLocales('home') },
  { path: '/products', locales },
  { path: '/channels', locales: seoPageLocales('channels') },
  { path: '/director', locales: seoPageLocales('director') },
  { path: '/tv-show-generator', locales: seoPageLocales('tv-show-generator') },
  { path: '/real-time', locales: seoPageLocales('real-time') },
  { path: '/interactive', locales: seoPageLocales('interactive') },
  { path: '/creators', locales: seoPageLocales('creators') },
  { path: '/privacy-policy', locales },
  { path: '/terms-of-service', locales },
];

type Entry = {
  path: string;
  /** Locales with their own copy — one <url> each, cross-linked by hreflang. */
  locales: readonly string[];
  lastModified?: string;
  changeFrequency: string;
  priority: number;
};

function urlFor(path: string, locale: string): string {
  return localizeUrl(`${envConfigs.app_url}${path || '/'}`, {
    locale: locale as (typeof locales)[number],
  }).href;
}

function entryXml(e: Entry): string {
  const alternates =
    e.locales.length > 1
      ? [
          ...e.locales.map(
            (loc) =>
              `    <xhtml:link rel="alternate" hreflang="${loc}" href="${urlFor(e.path, loc)}"/>`
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(e.path, baseLocale)}"/>`,
        ]
      : [];
  return e.locales
    .map((loc) =>
      [
        '  <url>',
        `    <loc>${urlFor(e.path, loc)}</loc>`,
        ...alternates,
        e.lastModified ? `    <lastmod>${e.lastModified}</lastmod>` : null,
        `    <changefreq>${e.changeFrequency}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = STATIC_PAGES.map((page) => ({
          path: page.path,
          locales: page.locales,
          changeFrequency: 'weekly',
          priority: page.path === '/' ? 1 : 0.8,
        }));

        for (const product of getProducts(baseLocale)) {
          entries.push({
            path: `/products/${product.slug}`,
            locales,
            lastModified: `${product.sourceUpdatedAt}T00:00:00.000Z`,
            changeFrequency: 'weekly',
            priority: 0.75,
          });
        }

        try {
          const submittedProducts = await listPublishedProductSubmissions();
          for (const product of submittedProducts) {
            entries.push({
              path: `/products/${product.slug}`,
              locales,
              lastModified: new Date(product.createdAt).toISOString(),
              changeFrequency: 'weekly',
              priority: 0.7,
            });
          }
        } catch {
          // Database unreachable — curated products remain in the sitemap.
        }

        for (const channel of getChannelsData().channels) {
          entries.push({
            path: `/channel/${channel.slug}`,
            locales: ['en'],
            lastModified: `${channel.lastVerifiedAt}T00:00:00.000Z`,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }

        // Blog posts: db posts merged with local MDX posts.
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
          const posts = mergePosts(dbPosts, getLocalPosts(baseLocale));
          if (posts.length) {
            entries.push({
              path: '/blog',
              locales,
              changeFrequency: 'daily',
              priority: 0.6,
            });
          }
          for (const post of posts) {
            entries.push({
              path: `/blog/${post.slug}`,
              locales,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        } catch {
          // Database unreachable — static paths + local posts still listed.
          for (const post of getLocalPosts(baseLocale)) {
            entries.push({
              path: `/blog/${post.slug}`,
              locales,
              lastModified: post.createdAt,
              changeFrequency: 'monthly',
              priority: 0.6,
            });
          }
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...entries.map(entryXml),
          '</urlset>',
          '',
        ].join('\n');

        return new Response(xml, {
          headers: { 'Content-Type': 'application/xml' },
        });
      },
    },
  },
});
