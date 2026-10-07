import type { ReactNode } from 'react';
import { notFound, useLoaderData } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import {
  getSeoPage,
  seoPageLocales,
  type SeoPageData,
} from '@/lib/seo-content';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { SeoPage } from '@/blocks/seo-page';

type LoaderData = SeoPageData & { locale: string };

/** Loader for a content-pages route — throws notFound when the pair is missing. */
export async function seoPageLoader(slug: string): Promise<LoaderData> {
  const locale = getLocale();
  const page = await getSeoPage(slug, locale);
  if (!page) throw notFound();
  return { ...page, locale };
}

/**
 * hreflang/canonical links for a page that exists in `available` locales.
 * A locale without its own copy renders the English fallback, so it
 * canonicalizes to the English URL instead of competing as a duplicate.
 */
export function localizedLinks(
  urlPath: string,
  locale: string,
  available: readonly string[] = locales
) {
  const urlFor = (loc: string) =>
    localizeUrl(`${envConfigs.app_url}${urlPath}`, {
      locale: loc as ReturnType<typeof getLocale>,
    }).href;
  const canonicalLocale = available.includes(locale) ? locale : 'en';
  const alternates = locales.filter((loc) => available.includes(loc));
  return {
    canonical: urlFor(canonicalLocale),
    links: [
      { rel: 'canonical', href: urlFor(canonicalLocale) },
      ...(alternates.length > 1
        ? [
            ...alternates.map((loc) => ({
              rel: 'alternate',
              hrefLang: loc,
              href: urlFor(loc),
            })),
            { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
          ]
        : []),
    ],
  };
}

/** head() for a content-pages route — meta + canonical/hreflang links. */
export function seoPageHead(
  urlPath: string,
  loaderData?: LoaderData,
  jsonLd?: Record<string, unknown>
) {
  if (!loaderData) return {};
  const { meta } = loaderData.json;
  const { canonical, links } = localizedLinks(
    urlPath,
    loaderData.locale,
    seoPageLocales(loaderData.slug)
  );
  const socialImage = new URL('/logo.png', envConfigs.app_url).href;
  return {
    meta: [
      { title: meta.title },
      { name: 'description', content: meta.description },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: canonical },
      { property: 'og:site_name', content: envConfigs.app_name },
      { property: 'og:image', content: socialImage },
      { property: 'og:image:alt', content: meta.title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: meta.title },
      { name: 'twitter:description', content: meta.description },
      { name: 'twitter:image', content: socialImage },
      ...(jsonLd ? [{ 'script:ld+json': jsonLd }] : []),
    ],
    links,
  };
}

/**
 * Shared route options for the static SEO pages (`home`, `director`,
 * `tv-show-generator`, …). Each page is an explicit route file so static
 * segments outrank dynamic ones — add a page by creating the content pair
 * under `content/pages/` plus a thin route file using this factory.
 * The homepage passes its own `component` (directory-first layout).
 */
export function seoPageRouteOptions(
  slug: string,
  urlPath: string,
  component: () => ReactNode = SeoRoutePage
) {
  return {
    loader: async (): Promise<LoaderData> => seoPageLoader(slug),
    head: ({ loaderData }: { loaderData?: LoaderData }) =>
      seoPageHead(urlPath, loaderData),
    component,
  };
}

function SeoRoutePage() {
  const data = useLoaderData({ strict: false }) as LoaderData | undefined;
  if (!data) return null;
  return (
    <SeoPage
      data={{
        h1: data.json.h1,
        segments: data.segments,
        faqs: data.json.faqs,
      }}
    />
  );
}
