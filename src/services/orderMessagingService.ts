import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { sendWhatsAppText } from '@/services/whatsappService';

export type OrderMessageAuthorType = 'admin' | 'customer' | 'system';
export type OrderMessageChannel = 'note' | 'chat' | 'whatsapp' | 'push' | 'system';
export type OrderMessageDeliveryStatus = 'sent' | 'failed' | 'skipped';
export type OrderMessageVisibility = 'internal' | 'customer';

export interface OrderMessage {
  id: string;
  authorType: OrderMessageAuthorType;
  authorId?: string;
  authorName?: string;
  channel: OrderMessageChannel;
  visibility: OrderMessageVisibility;
  message: string;
  createdAt?: Timestamp;
  deliveryStatus?: OrderMessageDeliveryStatus;
  metadata?: Record<string, string>;
}

interface CreateOrderMessageInput {
  authorType: OrderMessageAuthorType;
  authorId?: string;
  authorName?: string;
  channel: OrderMessageChannel;
  visibility: OrderMessageVisibility;
  message: string;
  deliveryStatus?: OrderMessageDeliveryStatus;
  metadata?: Record<string, string>;
}

interface SendOrderWhatsAppMessageInput {
  orderId: string;
  to?: string;
  message: string;
  authorId?: string;
  authorName?: string;
}

interface SendOrderPushMessageInput {
  orderId: string;
  userId: string;
  title: string;
  body: string;
  url?: string;
  authorId?: string;
  authorName?: string;
}

const ORDER_MESSAGES_COLLECTION = 'messages';
const ADMIN_NOTIFICATION_KEY_LS = 'adminNotificationKey';

const getOrderMessagesCollection = (orderId: string) =>
  collection(db, 'orders', orderId, ORDER_MESSAGES_COLLECTION);

const getAdminKeyHeader = () => {
  if (typeof window === 'undefined') return {};

  const key = window.localStorage.getItem(ADMIN_NOTIFICATION_KEY_LS) || '';
  return key ? { 'x-admin-key': key } : {};
};

export const createOrderMessage = async (
  orderId: string,
  input: CreateOrderMessageInput,
): Promise<void> => {
  await addDoc(getOrderMessagesCollection(orderId), {
    ...input,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToOrderMessages = (
  orderId: string,
  callback: (messages: OrderMessage[]) => void,
  onError?: (error: Error) => void,
) => {
  try {
    const messagesQuery = query(
      getOrderMessagesCollection(orderId),
      orderBy('createdAt', 'asc'),
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        callback(
          snapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          })) as OrderMessage[],
        );
      },
      (error) => {
        console.error('Error subscribing to order messages:', error);
        onError?.(error);
      },
    );
  } catch (error) {
    console.error('Error setting up order messages subscription:', error);
    onError?.(error as Error);
    return () => {};
  }
};

export const subscribeToCustomerOrderMessages = (
  orderId: string,
  callback: (messages: OrderMessage[]) => void,
  onError?: (error: Error) => void,
) => {
  try {
    const messagesQuery = query(
      getOrderMessagesCollection(orderId),
      where('visibility', '==', 'customer'),
      orderBy('createdAt', 'asc'),
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        callback(
          snapshot.docs.map((messageDoc) => ({
            id: messageDoc.id,
            ...messageDoc.data(),
          })) as OrderMessage[],
        );
      },
      (error) => {
        console.error('Error subscribing to customer order messages:', error);
        onError?.(error);
      },
    );
  } catch (error) {
    console.error('Error setting up customer order messages subscription:', error);
    onError?.(error as Error);
    return () => {};
  }
};

export const sendOrderWhatsAppMessage = async ({
  orderId,
  to,
  message,
  authorId,
  authorName,
}: SendOrderWhatsAppMessageInput): Promise<{ ok: boolean; status: OrderMessageDeliveryStatus; error?: string }> => {
  if (!to) {
    await createOrderMessage(orderId, {
      authorType: 'admin',
      authorId,
      authorName,
      channel: 'whatsapp',
      visibility: 'customer',
      message,
      deliveryStatus: 'skipped',
      metadata: { reason: 'missing-phone' },
    });
    return { ok: false, status: 'skipped', error: 'Customer phone number is missing' };
  }

  try {
    await sendWhatsAppText({ to, text: message });
    await createOrderMessage(orderId, {
      authorType: 'admin',
      authorId,
      authorName,
      channel: 'whatsapp',
      visibility: 'customer',
      message,
      deliveryStatus: 'sent',
    });
    return { ok: true, status: 'sent' };
  } catch (error) {
    const errorMessage = (error as Error).message || 'Failed to send WhatsApp message';
    await createOrderMessage(orderId, {
      authorType: 'admin',
      authorId,
      authorName,
      channel: 'whatsapp',
      visibility: 'customer',
      message,
      deliveryStatus: 'failed',
      metadata: { error: errorMessage },
    });
    return { ok: false, status: 'failed', error: errorMessage };
  }
};

export const sendOrderPushMessage = async ({
  orderId,
  userId,
  title,
  body,
  url,
  authorId,
  authorName,
}: SendOrderPushMessageInput): Promise<{ ok: boolean; status: OrderMessageDeliveryStatus; error?: string }> => {
  try {
    const tokensSnapshot = await getDocs(
      query(collection(db, 'userTokens'), where('uid', '==', userId)),
    );

    const tokens = tokensSnapshot.docs
      .map((tokenDoc) => String(tokenDoc.data().token || tokenDoc.id || ''))
      .filter(Boolean);

    if (!tokens.length) {
      await createOrderMessage(orderId, {
        authorType: 'admin',
        authorId,
        authorName,
        channel: 'push',
        visibility: 'customer',
        message: `${title}\n${body}`,
        deliveryStatus: 'skipped',
        metadata: { reason: 'missing-tokens' },
      });
      return { ok: false, status: 'skipped', error: 'No push-enabled devices found for this customer' };
    }

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminKeyHeader(),
      },
      body: JSON.stringify({
        tokens,
        title,
        body,
        ...(url ? { url } : {}),
        data: { orderId, source: 'admin-order-detail' },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      successCount?: number;
      failureCount?: number;
    };

    if (!response.ok || !data.ok) {
      const errorMessage = data.error || data.detail || `HTTP ${response.status}`;
      await createOrderMessage(orderId, {
        authorType: 'admin',
        authorId,
        authorName,
        channel: 'push',
        visibility: 'customer',
        message: `${title}\n${body}`,
        deliveryStatus: 'failed',
        metadata: { error: errorMessage },
      });
      return { ok: false, status: 'failed', error: errorMessage };
    }

    await createOrderMessage(orderId, {
      authorType: 'admin',
      authorId,
      authorName,
      channel: 'push',
      visibility: 'customer',
      message: `${title}\n${body}`,
      deliveryStatus: 'sent',
      metadata: {
        successCount: String(data.successCount || 0),
        failureCount: String(data.failureCount || 0),
      },
    });

    return { ok: true, status: 'sent' };
  } catch (error) {
    const errorMessage = (error as Error).message || 'Failed to send push notification';
    await createOrderMessage(orderId, {
      authorType: 'admin',
      authorId,
      authorName,
      channel: 'push',
      visibility: 'customer',
      message: `${title}\n${body}`,
      deliveryStatus: 'failed',
      metadata: { error: errorMessage },
    });
    return { ok: false, status: 'failed', error: errorMessage };
  }
};
