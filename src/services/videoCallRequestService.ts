import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VideoCallMode = 'instant' | 'scheduled';
export type VideoCallStatus =
  | 'pending'
  | 'confirmed'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type MeetingType = 'inapp' | 'meet';

export interface VideoCallRequest {
  id: string;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  mode: VideoCallMode;
  scheduledAt?: Timestamp | null;
  status: VideoCallStatus;
  meetingType?: MeetingType;
  meetingUrl?: string;
  callId?: string;
  assignedAdminUid?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type CreatePayload = Omit<VideoCallRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>;

// ─────────────────────────────────────────────────────────────────────────────
// Collection ref
// ─────────────────────────────────────────────────────────────────────────────

const COL = 'videoCallRequests';

// ─────────────────────────────────────────────────────────────────────────────
// Customer operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createVideoCallRequest(
  payload: CreatePayload
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...payload,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function cancelVideoCallRequest(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

/** Realtime listener — customer's own requests */
export function listenMyRequests(
  uid: string,
  onChange: (requests: VideoCallRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('customerUid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoCallRequest))
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin operations
// ─────────────────────────────────────────────────────────────────────────────

/** Realtime listener — all pending + confirmed requests */
export function listenAdminQueue(
  onChange: (requests: VideoCallRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('status', 'in', ['pending', 'confirmed', 'live']),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoCallRequest))
    );
  });
}

/** Realtime listener — completed / cancelled history */
export function listenAdminHistory(
  onChange: (requests: VideoCallRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('status', 'in', ['completed', 'cancelled', 'no_show']),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onChange(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as VideoCallRequest))
    );
  });
}

export async function confirmWithMeet(
  id: string,
  meetUrl: string,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'confirmed',
    meetingType: 'meet',
    meetingUrl: meetUrl,
    assignedAdminUid: adminUid,
    updatedAt: serverTimestamp(),
  });
}

export async function confirmInApp(
  id: string,
  callId: string,
  adminUid: string
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'confirmed',
    meetingType: 'inapp',
    callId,
    assignedAdminUid: adminUid,
    updatedAt: serverTimestamp(),
  });
}

export async function markLive(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'live',
    updatedAt: serverTimestamp(),
  });
}

export async function markCompleted(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
}

export async function markNoShow(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'no_show',
    updatedAt: serverTimestamp(),
  });
}

export async function adminCancelRequest(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVideoCallRequest(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
