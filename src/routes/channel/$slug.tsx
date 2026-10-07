import { createFileRoute, notFound } from '@tanstack/react-router';

import {
  autoChannelMeta,
  findChannel,
  getCuratedChannelPage,
  type ChannelRecord,
  type Segment,
  type SeoFaq,
  type SeoMeta,
} from '@/lib/seo-content';
import { getLocale } from '@/paraglide/runtime.js';
import { ChannelPage } from '@/blocks/channel-page';

import { localizedLinks } from '../-seo-route';

type LoaderData = {
  channel: ChannelRecord;
  curated: { h1: string; segments: Segment[]; faqs?: SeoFaq[] } | null;
  meta: SeoMeta;
  locale: string;
};

export const Route = createFileRoute('/channel/$slug')({
  loader: async ({ params }): Promise<LoaderData> => {
    const channel = findChannel(params.slug);
    if (!channel) throw notFound();

    const curated = await getCuratedChannelPage(params.slug);
    const meta = curated?.json.meta ?? autoChannelMeta(channel);

    return { channel, curated, meta, locale: getLocale() };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { channel, meta, locale } = loaderData;
    // Channel copy is English-only — the /zh URL canonicalizes to it.
    const { links } = localizedLinks(`/channel/${channel.slug}`, locale, [
      'en',
    ]);
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links,
    };
  },
  component: () => {
    const { channel, curated } = Route.useLoaderData();
    return (
      <ChannelPage
        channel={channel}
        curated={
          curated
            ? {
                h1: curated.json.h1,
                segments: curated.segments,
                faqs: curated.json.faqs,
              }
            : null
        }
      />
    );
  },
});
