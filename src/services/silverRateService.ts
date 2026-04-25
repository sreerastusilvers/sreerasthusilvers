/**
 * Client-side silver rate service.
 *
 * Admin sets `manualPricePerGramInr` in Firestore `siteSettings/silverRate`.
 * This service subscribes in real-time via onSnapshot and computes 10g / 1kg.
 * Caches last known value in localStorage for first-paint performance.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

export type SilverRate = {
  pricePerGramInr: number;
  pricePerTenGramInr: number;
  pricePerKgInr: number;
  timestamp: number;
};

const CACHE_KEY = 'silverRate.admin.v1';

function readCache(): SilverRate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SilverRate;
  } catch {
    return null;
  }
}

function writeCache(rate: SilverRate) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rate));
  } catch {
    /* ignore quota errors */
  }
}

/** Returns the last known silver rate from localStorage — useful for first paint. */
export function getCachedSilverRate(): SilverRate | null {
  return readCache();
}

/**
 * Subscribes to the admin-set silver rate from Firestore in real-time.
 * Returns an unsubscribe function to clean up the listener.
 */
export function subscribeSilverRate(handler: (rate: SilverRate) => void): () => void {
  const rateRef = doc(db, 'siteSettings', 'silverRate');
  const unsub = onSnapshot(rateRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const pricePerGram =
      typeof data.manualPricePerGramInr === 'number' && data.manualPricePerGramInr > 0
        ? data.manualPricePerGramInr
        : 0;
    const rate: SilverRate = {
      pricePerGramInr: pricePerGram,
      pricePerTenGramInr: pricePerGram * 10,
      pricePerKgInr: pricePerGram * 1000,
      timestamp: Date.now(),
    };
    writeCache(rate);
    handler(rate);
  });
  return unsub;
}
