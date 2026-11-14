// Results entered without a connection wait here (on this device) and are sent to Rankedin when the
// connection is back. Each one remembers what the phone showed when it was entered (`expected`), so the
// server refuses to overwrite a result someone else reported meanwhile – that becomes a conflict to resolve.
import { useSyncExternalStore } from 'react';
import { ApiError, submitResult } from './api';
import { t } from './i18n';

export type Sets = [number, number][];
export type Queued = {
  challengeId: number;
  /** null = remove the result. */
  sets: Sets | null;
  expected: Sets;
  account: number;
  /** Shown in the list: "Aron / Eric – Tyra / Malvina". */
  title: string;
  at: number;
  state: 'waiting' | 'conflict' | 'failed';
  /** For conflicts: what Rankedin has now. */
  current?: Sets;
  message?: string;
};

const KEY = 'padeladmin.outbox';
let items: Queued[] = load();
const listeners = new Set<() => void>();

function load(): Queued[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function save(next: Queued[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable: kept in memory for this visit */
  }
  listeners.forEach((l) => l());
}

export const queued = () => items;
export function useOutbox(): Queued[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => items,
  );
}
export const queuedFor = (challengeId: number) => items.find((q) => q.challengeId === challengeId);

/** A fetch that never reached the server (offline, DNS, dropped connection) – not an answer from it. */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);

/** Queue (or replace) the result for a match. */
export function enqueue(q: Omit<Queued, 'at' | 'state'>) {
  save([...items.filter((x) => x.challengeId !== q.challengeId), { ...q, at: Date.now(), state: 'waiting' }]);
}
export const discard = (challengeId: number) => save(items.filter((x) => x.challengeId !== challengeId));
/** Conflict resolved by the user: send ours over what Rankedin has now. */
export function overwrite(challengeId: number) {
  save(items.map((x) => (x.challengeId === challengeId ? { ...x, expected: x.current ?? x.expected, current: undefined, state: 'waiting', message: undefined } : x)));
  void flush();
}

let flushing: Promise<number> | null = null;
/** Send everything waiting, one at a time. Returns how many went through. */
export function flush(send: typeof submitResult = submitResult): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    for (const q of items.filter((x) => x.state === 'waiting')) {
      try {
        await send(q.challengeId, q.sets, { expected: q.expected, account: q.account });
        save(items.filter((x) => x.challengeId !== q.challengeId));
        sent++;
      } catch (e) {
        if (isNetworkError(e)) break; // still offline: try again later
        const err = e as ApiError & { current?: Sets };
        save(
          items.map((x) =>
            x.challengeId !== q.challengeId
              ? x
              : err.code === 'conflict'
                ? { ...x, state: 'conflict', current: err.current ?? [] }
                : err.code === 'not_logged_in'
                  ? { ...x, message: t('Logga in igen för att skicka.') } // stays waiting
                  : { ...x, state: 'failed', message: err.message },
          ),
        );
        if (err.code === 'not_logged_in') break;
      }
    }
    return sent;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

let started = false;
/** Sends when the connection comes back, when the app opens and every 30 s while something waits. */
export function startOutbox(onSent: () => void) {
  if (started || typeof window === 'undefined') return;
  started = true;
  const go = () => {
    if (navigator.onLine && items.some((x) => x.state === 'waiting')) void flush().then((n) => n > 0 && onSent());
  };
  window.addEventListener('online', go);
  setInterval(go, 30_000);
  go();
}

/** Test helper. */
export function _reset(next: Queued[] = []) {
  save(next);
}
