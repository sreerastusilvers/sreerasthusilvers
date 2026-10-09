/** Dealer chats with unread messages, for the sidebar badge. */
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';

export function useDealerUnread(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const q = query(collection(db, 'dealers'), where('unreadCount', '>', 0), limit(100));
    return onSnapshot(
      q,
      (snap) => setCount(snap.size),
      () => setCount(0),
    );
  }, [enabled]);
  return count;
}
