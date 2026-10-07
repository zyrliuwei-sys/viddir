import handler from '@tanstack/react-start/server-entry';

import { envConfigs } from './config';
import { getCookieFromHeader } from './lib/cookie';
import { paraglideMiddleware } from './paraglide/server.js';

// On Cloudflare Workers, stash the binding env (D1, ASSETS, …) on globalThis
// so synchronous code paths (e.g. the db() singleton with DATABASE_PROVIDER=d1)
// can reach bindings without threading the request context through every call.
// The specifier is kept non-literal so bundlers leave the import to runtime;
// outside workerd the import rejects and we just move on.
const CF_WORKERS_MODULE = 'cloudflare:workers';
let cfEnvPromise: Promise<void> | null = null;

function ensureCloudflareEnv(): Promise<void> {
  if (!cfEnvPromise) {
    cfEnvPromise = import(/* @vite-ignore */ CF_WORKERS_MODULE)
      .then((mod) => {
        (globalThis as any).__CF_ENV__ = mod.env;
      })
      .catch(() => {
        // Not running on Cloudflare Workers — nothing to stash.
      });
  }
  return cfEnvPromise;
}

/**
 * 301 the apex domain and plain http to the canonical https://www.<domain>
 * origin from VITE_APP_URL, so search engines see one host instead of four.
 * Only applies when the canonical host is a www. host (never in local dev).
 */
function canonicalHostRedirect(req: Request): Response | null {
  let canonical: URL;
  try {
    canonical = new URL(envConfigs.app_url);
  } catch {
    return null;
  }
  if (!canonical.hostname.startsWith('www.')) return null;

  const url = new URL(req.url);
  const isApex = url.hostname === canonical.hostname.slice(4);
  const isInsecure =
    url.hostname === canonical.hostname &&
    url.protocol === 'http:' &&
    canonical.protocol === 'https:';
  if (!isApex && !isInsecure) return null;

  url.protocol = canonical.protocol;
  url.hostname = canonical.hostname;
  url.port = canonical.port;
  return Response.redirect(url.href, 301);
}

// Custom server entry — wraps every request in Paraglide's middleware so
// getLocale() resolves per-request (AsyncLocalStorage) during SSR.
export default {
  async fetch(req: Request): Promise<Response> {
    const redirect = canonicalHostRedirect(req);
    if (redirect) return redirect;

    await ensureCloudflareEnv();
    const response = await paraglideMiddleware(req, () => handler.fetch(req));
    const utmSource = new URL(req.url).searchParams.get('utm_source');
    const existing = getCookieFromHeader(
      req.headers.get('cookie'),
      'utm_source'
    );
    if (utmSource && !existing) {
      const sanitized = utmSource.replace(/[^\w.\-]/g, '').slice(0, 100);
      if (sanitized) {
        response.headers.append(
          'Set-Cookie',
          `utm_source=${sanitized}; Max-Age=2592000; Path=/; SameSite=Lax`
        );
      }
    }
    return response;
  },
};
