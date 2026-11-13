// Vercel Web Analytics: page views only, no cookies. Paths are made anonymous before
// they leave the browser – player numbers and ids are replaced, query strings dropped –
// so the statistics can never point at a child.
import { inject } from '@vercel/analytics';

export function anonymousPath(url: string): string {
  const u = new URL(url, 'https://x');
  const path = u.pathname
    .replace(/\/R\d+/gi, '/:spelare')
    .replace(/\/\d{4}-\d{2}-\d{2}/g, '/:datum')
    .replace(/\/\d+/g, '/:id');
  return `${u.origin}${path}`;
}

export function startAnalytics() {
  inject({
    mode: import.meta.env.DEV ? 'development' : 'production',
    debug: false,
    beforeSend: (event) => ({ ...event, url: anonymousPath(event.url) }),
  });
}
