import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  DEFAULT_JEWELLERY_OFFER,
  sanitizeOfferSettings,
  type JewelleryOfferSettings,
} from '@/lib/jewelleryOffer';

/** Public, admin-written: api/create-order.ts reads the same document. */
const OFFER_DOC = doc(db, 'siteSettings', 'jewelleryOffer');

let current: JewelleryOfferSettings = DEFAULT_JEWELLERY_OFFER;
const listeners = new Set<(s: JewelleryOfferSettings) => void>();
let unsubscribe: (() => void) | null = null;

/** One shared listener however many banners, carts and checkouts are mounted. */
export function subscribeJewelleryOffer(cb: (s: JewelleryOfferSettings) => void) {
  listeners.add(cb);
  cb(current);
  if (!unsubscribe) {
    unsubscribe = onSnapshot(
      OFFER_DOC,
      (snap) => {
        current = sanitizeOfferSettings(snap.exists() ? snap.data() : null);
        listeners.forEach((l) => l(current));
      },
      (err) => {
        console.error('subscribeJewelleryOffer error', err);
      },
    );
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

export function useJewelleryOfferSettings(): JewelleryOfferSettings {
  const [s, setS] = useState(current);
  useEffect(() => subscribeJewelleryOffer(setS), []);
  return s;
}

export async function saveJewelleryOffer(settings: JewelleryOfferSettings): Promise<void> {
  const clean = sanitizeOfferSettings(settings);
  await setDoc(OFFER_DOC, { ...clean, updatedAt: serverTimestamp() });
}
