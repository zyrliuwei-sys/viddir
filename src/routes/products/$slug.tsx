import { createFileRoute, notFound } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import {
  getProductHeading,
  type CatalogLocale,
  type CatalogProduct,
} from '@/lib/mock-ai-products';
import { getCatalogProductFn } from '@/lib/product-submissions-server';
import { m } from '@/paraglide/messages.js';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { AiProductDetail } from '@/blocks/ai-product-detail';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/** CJK characters render about twice as wide as Latin ones in a SERP snippet. */
function displayWidth(text: string) {
  let width = 0;
  for (const char of text) {
    width += /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1;
  }
  return width;
}

/**
 * Detail-page <title>: the longest variant that fits Google's ~60-column
 * display. Keyword pages lead with "Name - Keyword"; others keep the
 * "official website" angle that matches navigational searches.
 */
function getProductTitle(product: CatalogProduct, locale: CatalogLocale) {
  const heading = getProductHeading(product);
  const brand = ` | ${envConfigs.app_name}`;
  const hasKeyword = heading !== product.name;
  const variants =
    locale === 'zh'
      ? [
          `${heading}：${hasKeyword ? '' : '官网入口、'}是什么、怎么用${brand}`,
          `${heading}：是什么、怎么用${brand}`,
          `${heading}${brand}`,
        ]
      : [
          `${heading}: ${hasKeyword ? '' : 'Official Website, '}What It Is & How to Use${brand}`,
          `${heading}: What It Is & How to Use${brand}`,
          `${heading}: What It Is & How to Use`,
          `${heading}${brand}`,
        ];
  return variants.find((title) => displayWidth(title) <= TITLE_MAX) ?? heading;
}

/**
 * Trim to ~160 display columns (≈80 CJK characters) at a sentence or word
 * boundary so search snippets aren't cut mid-word.
 */
function clampDescription(text: string) {
  if (displayWidth(text) <= DESCRIPTION_MAX) return text;
  let cut = '';
  for (const char of text) {
    if (displayWidth(cut + char) > DESCRIPTION_MAX - 1) break;
    cut += char;
  }
  const sentenceEnd = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('。'),
    cut.lastIndexOf('！'),
    cut.lastIndexOf('？')
  );
  if (displayWidth(cut.slice(0, sentenceEnd + 1)) >= 80) {
    return cut.slice(0, sentenceEnd + 1).trim();
  }
  const wordEnd = cut.lastIndexOf(' ');
  return `${(wordEnd >= 40 ? cut.slice(0, wordEnd) : cut).trimEnd()}…`;
}

function getProductSchema(
  product: CatalogProduct | null,
  canonical: string,
  locale: CatalogLocale
) {
  if (!product) return null;

  const sourceSchema = {
    '@type': 'SoftwareApplication',
    '@id': `${canonical}#software`,
    name: product.name,
    description: product.seo.whatIs,
    url: product.website,
    ...(product.previewImage
      ? { image: new URL(product.previewImage, envConfigs.app_url).href }
      : {}),
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    publisher: {
      '@type': 'Organization',
      name: product.maker,
    },
    keywords: [
      ...new Set([
        ...(product.seoKeyword ? [product.seoKeyword] : []),
        ...(product.aliases ?? []),
        ...product.tagNames,
      ]),
    ],
    inLanguage: locale,
    mainEntityOfPage: canonical,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      sourceSchema,
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: m['catalog.breadcrumb.home']({}, { locale }),
            item: localizeUrl(`${envConfigs.app_url}/`, { locale }).href,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: m['catalog.breadcrumb.products']({}, { locale }),
            item: localizeUrl(`${envConfigs.app_url}/products`, { locale })
              .href,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: canonical,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        mainEntity: product.seo.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };
}

export const Route = createFileRoute('/products/$slug')({
  loader: async ({ params }) => {
    const locale: CatalogLocale = getLocale() === 'zh' ? 'zh' : 'en';
    const product = await getCatalogProductFn({
      data: { slug: params.slug, locale },
    });
    if (!product) throw notFound();
    return { locale, product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { locale, product } = loaderData;
    const canonical = localizeUrl(
      `${envConfigs.app_url}/products/${product.slug}`,
      {
        locale,
      }
    ).href;
    const title = getProductTitle(product, locale);
    const description = clampDescription(product.seo.whatIs);
    const previewImage = product.previewImage
      ? new URL(product.previewImage, envConfigs.app_url).href
      : undefined;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: canonical },
        ...(previewImage
          ? [{ property: 'og:image', content: previewImage }]
          : []),
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { 'script:ld+json': getProductSchema(product, canonical, locale) },
      ],
      links: [
        { rel: 'canonical', href: canonical },
        ...locales.map((localizedLocale) => ({
          rel: 'alternate',
          hrefLang: localizedLocale,
          href: localizeUrl(`${envConfigs.app_url}/products/${product.slug}`, {
            locale: localizedLocale as CatalogLocale,
          }).href,
        })),
        {
          rel: 'alternate',
          hrefLang: 'x-default',
          href: localizeUrl(`${envConfigs.app_url}/products/${product.slug}`, {
            locale: 'en',
          }).href,
        },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { locale, product } = Route.useLoaderData();
  return <AiProductDetail locale={locale} product={product} />;
}
