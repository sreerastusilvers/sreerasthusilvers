/**
 * Dealers (manufacturers) and their WhatsApp chats.
 *
 *   dealers/{id}               display name + chat summary. Staff with the
 *                              "Dealer chats" page read it; the server writes
 *                              the chat fields, the owner writes the rest.
 *   dealers/{id}/messages/{m}  the conversation (server-written).
 *   dealerPrivate/{id}         phone + real name. Owner and server only.
 *   dealerTickets/{id}         T-0001… requests raised by staff.
 *   siteSettings/dealerChat    which approved template opens a conversation.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Dealer {
  id: string;
  displayName: string;
  note?: string;
  active: boolean;
  lastMessage?: string;
  lastMessageType?: string;
  lastDirection?: 'inbound' | 'outbound';
  lastAt?: Timestamp;
  lastStatus?: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
  replyWindowClosesAt?: Timestamp;
  unreadCount?: number;
  awaitingReply?: boolean;
  lastTicketId?: string;
  lastTicketNumber?: string;
  createdAt?: Timestamp;
}

export interface DealerPrivate {
  phone: string;
  originalName: string;
  waProfileName?: string;
}

export interface DealerMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  type?: string;
  text?: string;
  template?: { name?: string; language?: string; params?: string[] };
  media?: { id: string; mimeType?: string | null; caption?: string | null; filename?: string | null; voice?: boolean } | null;
  location?: { latitude: number; longitude: number; name?: string | null; address?: string | null } | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
  sentByName?: string | null;
  createdAt?: Timestamp | null;
  providerMessageId?: string | null;
  status?: 'accepted' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: { code?: number | null; title?: string | null; message?: string | null } | null;
}

export interface DealerTicket {
  id: string;
  number: string;
  dealerId: string;
  dealerName: string;
  subject: string;
  details?: string;
  status: 'open' | 'closed';
  createdByName?: string;
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp;
  lastDealerReplyAt?: Timestamp;
  closedByName?: string;
  /** The WhatsApp message that opened the ticket (its bubble shows the ticket). */
  openingMessageId?: string | null;
}

export interface DealerChatSettings {
  templateName: string;
  language: string;
}

/** "98765 43210" or "+91 98765 43210" → "+919876543210" (10 digits get +91). */
export function normalizeDealerPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : '';
}

export function subscribeDealers(cb: (d: Dealer[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'dealers'),
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, active: true, ...(d.data() as Omit<Dealer, 'id'>) }));
      list.sort((a, b) => (b.lastAt?.toMillis() || 0) - (a.lastAt?.toMillis() || 0) || a.displayName.localeCompare(b.displayName));
      cb(list);
    },
    (e) => onError?.(e),
  );
}

export function subscribeDealerMessages(dealerId: string, cb: (m: DealerMessage[]) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    query(collection(db, 'dealers', dealerId, 'messages'), orderBy('createdAt', 'asc'), limit(500)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DealerMessage, 'id'>) }))),
    (e) => onError?.(e),
  );
}

export function subscribeDealerTickets(dealerId: string | null, cb: (t: DealerTicket[]) => void, onError?: (e: Error) => void) {
  const base = collection(db, 'dealerTickets');
  const q = dealerId ? query(base, where('dealerId', '==', dealerId)) : query(base, orderBy('createdAt', 'desc'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DealerTicket, 'id'>) }));
      list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      cb(list);
    },
    (e) => onError?.(e),
  );
}

export async function setTicketStatus(ticketId: string, status: 'open' | 'closed', by: { uid: string; name: string }) {
  await updateDoc(doc(db, 'dealerTickets', ticketId), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === 'closed'
      ? { closedAt: serverTimestamp(), closedByUid: by.uid, closedByName: by.name }
      : { closedAt: null, closedByUid: null, closedByName: null }),
  });
}

// ── Owner only ───────────────────────────────────────────────────────────────
export function subscribeDealerPrivate(cb: (byId: Record<string, DealerPrivate>) => void, onError?: (e: Error) => void) {
  return onSnapshot(
    collection(db, 'dealerPrivate'),
    (snap) => {
      const out: Record<string, DealerPrivate> = {};
      snap.docs.forEach((d) => {
        const v = d.data();
        out[d.id] = { phone: v.phone || '', originalName: v.originalName || '', waProfileName: v.waProfileName || '' };
      });
      cb(out);
    },
    (e) => onError?.(e),
  );
}

export async function saveDealer(input: { id?: string; displayName: string; originalName: string; phone: string; note?: string; active: boolean }) {
  const phone = normalizeDealerPhone(input.phone);
  if (!phone) throw new Error('Enter the WhatsApp number with country code, for example 98765 43210 or +91 98765 43210.');
  const ref = input.id ? doc(db, 'dealers', input.id) : doc(collection(db, 'dealers'));
  const batch = writeBatch(db);
  batch.set(
    ref,
    {
      displayName: input.displayName.trim(),
      note: (input.note || '').trim(),
      active: input.active,
      updatedAt: serverTimestamp(),
      ...(input.id ? {} : { createdAt: serverTimestamp(), unreadCount: 0 }),
    },
    { merge: true },
  );
  batch.set(doc(db, 'dealerPrivate', ref.id), { phone, originalName: input.originalName.trim(), updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
  return ref.id;
}

/** Both documents go to the recycle bin (admin-panel deletes are binned). */
export async function removeDealer(id: string) {
  await deleteDoc(doc(db, 'dealerPrivate', id));
  await deleteDoc(doc(db, 'dealers', id));
}

export async function getDealerChatSettings(): Promise<DealerChatSettings | null> {
  const snap = await getDoc(doc(db, 'siteSettings', 'dealerChat'));
  const d = snap.data();
  return d?.templateName ? { templateName: String(d.templateName), language: String(d.language || 'en') } : null;
}

export async function saveDealerChatSettings(s: DealerChatSettings) {
  await setDoc(doc(db, 'siteSettings', 'dealerChat'), { ...s, updatedAt: serverTimestamp() }, { merge: true });
}

/** The template that opens a dealer conversation. Wording avoids the 24 h rule on purpose. */
export const DEALER_TEMPLATE = {
  baseName: 'dealer_enquiry',
  language: 'en',
  category: 'UTILITY' as const,
  body: 'Hello, this is Sreerasthu Silvers. We have a new requirement for you (ref {{1}}): {{2}}. Please reply to this message so we can share the details and photos.',
  examples: ['T-0012', 'Silver anklets, 2 pairs, about 40 g each, design photo to follow'],
  paramLabels: ['Ticket number', 'What we need'],
};
