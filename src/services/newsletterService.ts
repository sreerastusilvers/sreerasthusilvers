import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  where,
  getDocs,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

const COL = 'newsletterSubscriptions';

export interface NewsletterSubscription {
  id: string;
  email: string;
  subscribedAt: Timestamp;
}

/** Subscribe an email. Returns 'new' if added, 'exists' if already subscribed. */
export async function subscribeEmail(email: string): Promise<'new' | 'exists'> {
  const normalised = email.trim().toLowerCase();
  // Check for existing subscription
  const existing = await getDocs(
    query(collection(db, COL), where('email', '==', normalised))
  );
  if (!existing.empty) return 'exists';
  await addDoc(collection(db, COL), {
    email: normalised,
    subscribedAt: serverTimestamp(),
  });
  return 'new';
}

/** Realtime listener for admin — returns all subscriptions newest-first. */
export function listenNewsletterSubscriptions(
  onChange: (subs: NewsletterSubscription[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), orderBy('subscribedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as NewsletterSubscription))
    );
  });
}
