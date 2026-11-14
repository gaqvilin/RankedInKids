// Offline support: the service worker keeps the app on the device, the outbox sends queued results when back online.
import { startOutbox } from './outbox';

export function startOffline() {
  if (typeof window === 'undefined') return;
  startOutbox(() => window.dispatchEvent(new Event('padeladmin:results-sent')));
  // Only in the built app: in dev the worker would keep serving stale modules.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* unsupported or blocked: the app simply needs a connection */
      });
    });
  }
}
