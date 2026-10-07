import { createFileRoute } from '@tanstack/react-router';

import { envConfigs } from '@/config';
import { type CatalogLocale } from '@/lib/mock-ai-products';
import { listCatalogProductsFn } from '@/lib/product-submissions-server';
import { getLocale, localizeUrl } from '@/paraglide/runtime.js';
import { HomeDirectory } from '@/blocks/home-directory';

import { seoPageHead, seoPageLoader } from './-seo-route';

/** Homepage: the trending AI tools directory (primary keyword "ai tools directory"). */
export const Route = createFileRoute('/')({
  loader: async () => {
    const page = await seoPageLoader('home');
    const locale: CatalogLocale = page.locale === 'zh' ? 'zh' : 'en';
    const products = await listCatalogProductsFn({
      data: { locale },
    });

    return {
      ...page,
      products,
    };
  },
  head: ({ loaderData }) =>
    seoPageHead(
      '/',
      loaderData,
      loaderData && {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: envConfigs.app_name,
        url: localizeUrl(`${envConfigs.app_url}/`, {
          locale: loaderData.locale as ReturnType<typeof getLocale>,
        }).href,
        description: loaderData.json.meta.description,
        inLanguage: loaderData.locale,
      }
    ),
  component: HomePage,
});

function HomePage() {
  const data = Route.useLoaderData();
  return <HomeDirectory h1={data.json.h1} products={data.products} />;
}
