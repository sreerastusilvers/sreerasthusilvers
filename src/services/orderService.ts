import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  increment,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  sendOrderPlacedTemplate,
  sendAdminNewOrderTemplate,
  sendDeliveryAssignedTemplate,
  sendOutForDeliveryTemplate,
  sendOrderDeliveredTemplate,
  sendOrderCancelledTemplate,
  sendOrderRefundedTemplate,
  sendReturnUpdateTemplate,
  sendTimeslotTemplate,
  sendAdminOrderDeliveredTemplate,
  sendAdminReturnRequestedTemplate,
  sendAdminReturnPickedTemplate,
  sendAdminReturnedTemplate,
  normalizePhoneNumber,
} from '@/services/whatsappService';
import { notifyOrder } from '@/services/pushNotificationService';
import { incrementCouponUsage } from '@/services/couponService';

/**
 * Fetches the admin's WhatsApp notification number.
 * Priority: siteSettings/adminNotification.whatsappNumber (set from /admin/settings page)
 * Fallback: siteSettings/customerSupport.whatsapp (set from Commerce → Customer Support)
 * Not cached — ensures the latest number is always used.
 */
const getAdminNotificationPhone = async (): Promise<string> => {
  try {
    // Primary: admin settings page
    const adminSnap = await getDoc(doc(db, 'siteSettings', 'adminNotification'));
    if (adminSnap.exists()) {
      const num = String(adminSnap.data()?.whatsappNumber || '').trim();
      if (num) return num;
    }
    // Fallback: Commerce → Customer Support whatsapp field
    const snap = await getDoc(doc(db, 'siteSettings', 'customerSupport'));
    return snap.exists() ? String(snap.data()?.whatsapp || '') : '';
  } catch {
    return '';
  }
};

/**
 * Friendly phrasing for each canonical/legacy status — shared between
 * WhatsApp + web push so the customer sees consistent messages.
 */
const STATUS_PHRASE: Record<string, string> = {
  pending: 'has been received and is awaiting confirmation',
  processing: 'is being prepared',
  packed: 'has been packed and is ready for dispatch',
  shipped: 'has been shipped',
  assigned: 'has been assigned to a delivery partner',
  picked: 'has been picked up by our delivery partner',
  outForDelivery: 'is out for delivery',
  delivered: 'has been delivered',
  cancelled: 'was cancelled',
  returnRequested: 'return request has been received',
  returnScheduled: 'return has been scheduled',
  returned: 'return is complete',
  refunded: 'has been refunded',
  deliveryFailed: 'delivery attempt failed',
};

const shortOrderRef = (orderId: string) => `#${orderId.slice(-6).toUpperCase()}`;

/** Summarise order items into a short human-readable string for notifications. */
const makeItemsSummary = (items?: Array<{ name: string; quantity?: number }>): string => {
  if (!items || items.length === 0) return 'your items';
  if (items.length === 1) return items[0].name;
  if (items.length === 2) return `${items[0].name} & ${items[1].name}`;
  return `${items[0].name} + ${items.length - 1} more`;
};

/**
 * Best-effort delivery of WhatsApp + web-push notifications when an order's
 * status changes. Never throws — Firestore writes are the source of truth.
 *
 * WhatsApp is only sent for status events that are meaningful to the recipient:
 *   Customer  → outForDelivery, delivered, cancelled
 *   Admin     → delivered, returnRequested, picked (return context), returned
 * (Order placed and return approve/reject are handled at their own call sites.)
 */
const dispatchStatusNotifications = async (
  orderId: string,
  status: Order['status'],
  ctx?: {
    phone?: string;
    userPhone?: string;
    customerName?: string;
    items?: OrderItem[];
    /** set to true when the 'picked' event is a return pickup, not a forward delivery */
    isReturnPick?: boolean;
  },
): Promise<void> => {
  try {
    const notifyPhone = ctx?.userPhone || ctx?.phone;
    const items = makeItemsSummary(ctx?.items);
    const name = ctx?.customerName || 'Customer';

    // ── Customer WhatsApp (targeted — only events that matter to the buyer) ──
    if (notifyPhone) {
      if (status === 'outForDelivery') {
        void sendOutForDeliveryTemplate({ to: notifyPhone, customerName: name, orderId, itemsSummary: items });
      } else if (status === 'delivered') {
        void sendOrderDeliveredTemplate({ to: notifyPhone, customerName: name, orderId, itemsSummary: items });
      } else if (status === 'cancelled') {
        void sendOrderCancelledTemplate({ to: notifyPhone, customerName: name, orderId, itemsSummary: items });
      } else if (status === 'refunded') {
        void sendOrderRefundedTemplate({ to: notifyPhone, customerName: name, orderId, itemsSummary: items });
      }
      // All other status changes: web-push only (no WhatsApp)
    }

    // ── Admin WhatsApp ────────────────────────────────────────────────────────
    const adminPhone = await getAdminNotificationPhone();
    if (adminPhone) {
      if (status === 'delivered') {
        void sendAdminOrderDeliveredTemplate({ to: adminPhone, orderId, customerName: name });
      } else if (status === 'returnRequested') {
        void sendAdminReturnRequestedTemplate({ to: adminPhone, orderId, customerName: name, itemsSummary: items });
      } else if (status === 'picked' && ctx?.isReturnPick) {
        void sendAdminReturnPickedTemplate({ to: adminPhone, orderId, itemsSummary: items });
      } else if (status === 'returned') {
        void sendAdminReturnedTemplate({ to: adminPhone, orderId, customerName: name, itemsSummary: items });
      }
    }

    // ── Web push to the customer (all statuses) ───────────────────────────────
    const phrase = STATUS_PHRASE[status] || `status changed to ${status}`;
    void notifyOrder({
      orderId,
      audience: 'customer',
      title: 'Order update',
      body: `Your order ${shortOrderRef(orderId)} ${phrase}.`,
      url: `/account/orders/${orderId}`,
      data: { status, type: 'order-status' },
    });
  } catch (err) {
    console.warn('[orderService] notification dispatch failed:', err);
  }
};

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
}

export interface ShippingAddress {
  fullName: string;
  mobile: string;
  pincode: string;
  address: string;
  locality?: string;
  city: string;
  state: string;
  landmark?: string;
  alternativePhone?: string;
  addressType: 'home' | 'work';
  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  orderId: string; // Unique order number for display
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string; // Customer's registered WhatsApp/phone number — used for notifications
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  taxAmount: number;
  discount: number;
  total: number;
  // Coupon snapshot — captured at order placement so admin views and
  // invoice PDFs reflect what the customer actually paid even if the
  // underlying coupon document changes or is deleted later.
  couponCode?: string;
  couponId?: string;
  couponDescription?: string;
  couponType?: 'percent' | 'flat';
  couponValue?: number;
  couponDiscount?: number;
  // GST snapshot — same rationale as coupon snapshot above.
  gstRate?: number;
  gstInclusive?: boolean;
  // COD surcharge applied to this order (0 when not COD).
  codCharge?: number;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentCollectedAt?: Timestamp;
  paymentCollectedBy?: string;
  paymentCollectedByName?: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  // Canonical statuses. Legacy values 'shipped' | 'assigned' | 'picked' are kept in the
  // union for backward compatibility with historical Firestore documents but should be
  // normalised to the canonical values via `normalizeOrderStatus` for display/logic.
  status: 'pending' | 'processing' | 'packed' | 'outForDelivery' | 'delivered' | 'cancelled' | 'returnRequested' | 'returnScheduled' | 'returned' | 'refunded' | 'shipped' | 'assigned' | 'picked' | 'deliveryFailed';
  // Tracking fields
  trackingId?: string;
  carrier?: string;
  trackingUrl?: string;
  lastUpdated?: Timestamp;
  statusHistory?: {
    status: string;
    timestamp: Timestamp;
    note?: string;
  }[];
  // Delivery assignment fields (delivery_boy_* kept for legacy data; delivery_partner_*
  // are the canonical names going forward).
  delivery_boy_id?: string;
  delivery_boy_name?: string;
  delivery_partner_id?: string;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  assignedAt?: Timestamp;
  deliveryNotes?: string;
  // Convenience field used by the customer order page
  deliveryBoyId?: string;
  // OTP verification fields
  delivery_otp?: string;
  otp_verified?: boolean;
  otp_generated_at?: Timestamp;
  // Cancellation fields
  cancellationReason?: string;
  cancelledAt?: Timestamp;
  cancelledBy?: 'user' | 'admin';
  // Return fields
  returnReason?: string;
  returnRequestedAt?: Timestamp;
  returnApprovedAt?: Timestamp;
  returnRejectedAt?: Timestamp;
  returnStatus?: 'pending' | 'approved' | 'rejected';
  returnCancelled?: boolean;
  returnCancelledAt?: Timestamp;
  // Delivery window fields (set by admin or delivery partner)
  delivery_window_date?: string;   // ISO date string, e.g. '2026-04-25'
  delivery_window_from?: string;   // 24h time string, e.g. '14:00'
  delivery_window_to?: string;     // 24h time string, e.g. '17:00'
  delivery_window_note?: string;
  // Return pickup window fields (set by admin or pickup partner before pickup)
  return_window_date?: string;
  return_window_from?: string;
  return_window_to?: string;
  return_window_note?: string;
  // Failed delivery fields
  deliveryFailedAt?: Timestamp;
  deliveryFailureReason?: string;
  deliveredAt?: Timestamp;
  // Refund receipt fields (uploaded by admin when order is refunded)
  refundReceiptUrl?: string;
  refundReceiptUploadedAt?: Timestamp;
  refundReceiptType?: 'pdf' | 'image';
  refundReceiptName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderFormData = Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;

const ORDERS_COLLECTION = 'orders';

const isPrepaidPaymentMethod = (paymentMethod?: string | null): boolean => {
  const value = String(paymentMethod || '').toLowerCase();
  return (
    value.includes('online') ||
    value.includes('upi') ||
    value.includes('card') ||
    value.includes('net banking') ||
    value.includes('wallet') ||
    value.includes('razorpay')
  );
};

export const isCashOnDeliveryOrder = (order: Pick<Order, 'paymentMethod'>): boolean => {
  const value = String(order.paymentMethod || '').toLowerCase();
  return value.includes('cash on delivery') || value === 'cod' || value.includes('cash');
};

export const isPaymentSettled = (
  order: Pick<Order, 'paymentMethod' | 'paymentStatus'>,
): boolean => {
  if (order.paymentStatus === 'paid') return true;
  return isPrepaidPaymentMethod(order.paymentMethod);
};

/**
 * Normalise a raw status (which may include legacy values shipped/assigned/picked)
 * to the canonical workflow used by all UI surfaces.
 */
export const normalizeOrderStatus = (status: string | undefined | null): Order['status'] => {
  switch (status) {
    case 'shipped':
    case 'assigned':
      return 'packed';
    case 'picked':
      return 'outForDelivery';
    default:
      return (status as Order['status']) || 'pending';
  }
};

/**
 * Canonical status order used for forward-only validation. Cancelled / return
 * statuses are exception flows and are not part of the linear progression.
 */
const CANONICAL_FLOW: Order['status'][] = [
  'pending',
  'processing',
  'packed',
  'outForDelivery',
  'delivered',
];

/**
 * Returns true when transitioning from `from` to `to` is allowed.
 * Rules:
 *   - Cancelled / return statuses are always allowed (exception flow).
 *   - Otherwise, only forward movement on the canonical flow is allowed.
 */
export const isValidStatusTransition = (
  from: Order['status'],
  to: Order['status'],
): boolean => {
  const fromN = normalizeOrderStatus(from);
  const toN = normalizeOrderStatus(to);
  if (fromN === toN) return false;
  // Exception flow always allowed.
  if (['cancelled', 'returnRequested', 'returnScheduled', 'returned', 'refunded', 'deliveryFailed'].includes(toN)) {
    return true;
  }
  // deliveryFailed can only move forward to returned.
  if (fromN === 'deliveryFailed') {
    return toN === 'returned';
  }
  const fromIdx = CANONICAL_FLOW.indexOf(fromN);
  const toIdx = CANONICAL_FLOW.indexOf(toN);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx > fromIdx;
};

/**
 * Returns the next logical status in the canonical flow (or null if at the end).
 */
export const getNextStatus = (current: Order['status']): Order['status'] | null => {
  const idx = CANONICAL_FLOW.indexOf(normalizeOrderStatus(current));
  if (idx === -1 || idx >= CANONICAL_FLOW.length - 1) return null;
  return CANONICAL_FLOW[idx + 1];
};

/**
 * Create a new order
 */
export const createOrder = async (orderData: OrderFormData): Promise<string> => {
  try {
    const now = Timestamp.now();
    const paymentStatus = isPrepaidPaymentMethod(orderData.paymentMethod) ? 'paid' : 'pending';
    const orderWithTimestamps = {
      ...orderData,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), orderWithTimestamps);

    // Atomically decrement stock for each item — best-effort so a product
    // doc failure never blocks order placement.
    try {
      await Promise.all(
        (orderData.items || []).map(item =>
          updateDoc(doc(db, 'products', item.productId), {
            'inventory.stock': increment(-item.quantity),
          })
        )
      );
      await updateDoc(docRef, { stockDecremented: true });
    } catch (err) {
      console.warn('[orderService] stock decrement failed:', err);
    }

    // Atomically bump coupon usage counter so admin limits (maxUses) and
    // visibility ("used X / Y") stay in sync with reality. We do this AFTER
    // the order doc is committed so a failed Firestore write never bumps the
    // counter; we swallow errors so a counter glitch never breaks placement.
    if (orderData.couponId) {
      try {
        await incrementCouponUsage(orderData.couponId);
      } catch (err) {
        console.warn('[orderService] couponUsage increment failed:', err);
      }
    }

    // Best-effort web push to the customer who just placed the order, plus a
    // heads-up to the admin team. Both are fire-and-forget.
    void notifyOrder({
      orderId: docRef.id,
      audience: 'customer',
      title: 'Order placed successfully',
      body: `Thanks${orderData.userName ? `, ${orderData.userName.split(' ')[0]}` : ''}! Your order ${shortOrderRef(docRef.id)} has been placed.`,
      url: `/account/orders/${docRef.id}`,
      data: { type: 'order-placed' },
    });
    void notifyOrder({
      orderId: docRef.id,
      audience: 'admins',
      title: 'New order received',
      body: `Order ${shortOrderRef(docRef.id)} • ₹${Math.round(orderData.total)} from ${orderData.userName || 'a customer'}.`,
      url: `/admin/orders/${docRef.id}`,
      data: { type: 'order-placed' },
    });

    // WhatsApp template: customer confirmation.
    // Prefer the customer's registered WhatsApp/phone number; fall back to the
    // shipping address mobile so orders placed before userPhone was introduced
    // still get a notification.
    const customerNotifyPhone = orderData.userPhone || orderData.shippingAddress?.mobile;
    void sendOrderPlacedTemplate({
      to: normalizePhoneNumber(customerNotifyPhone),
      customerName: orderData.userName || 'Customer',
      orderId: docRef.id,
      total: orderData.total,
      itemsSummary: makeItemsSummary(orderData.items),
    });

    // WhatsApp template: admin new-order alert (phone from siteSettings).
    void (async () => {
      const adminPhone = await getAdminNotificationPhone();
      void sendAdminNewOrderTemplate({
        to: normalizePhoneNumber(adminPhone),
        orderId: docRef.id,
        total: orderData.total,
        customerName: orderData.userName || 'a customer',
        itemsSummary: makeItemsSummary(orderData.items),
      });
    })();

    return docRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order');
  }
};

/**
 * Get a single order by ID
 */
export const getOrder = async (orderId: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Order;
    }
    return null;
  } catch (error) {
    console.error('Error getting order:', error);
    throw new Error('Failed to get order');
  }
};

/**
 * Subscribe to a single order in real-time.
 */
export const subscribeToOrder = (
  orderId: string,
  callback: (order: Order | null) => void,
  onError?: (error: Error) => void,
): (() => void) => {
  try {
    return onSnapshot(
      doc(db, ORDERS_COLLECTION, orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }

        callback({
          id: snapshot.id,
          ...snapshot.data(),
        } as Order);
      },
      (error) => {
        console.error('Error subscribing to order:', error);
        if (onError) onError(error);
      },
    );
  } catch (error) {
    console.error('Error setting up order subscription:', error);
    throw new Error('Failed to subscribe to order');
  }
};

/**
 * Get all orders for a specific user
 */
export const getUserOrders = async (userId: string): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  } catch (error) {
    console.error('Error getting user orders:', error);
    throw new Error('Failed to get user orders');
  }
};

/**
 * Get all orders (admin only)
 */
export const getAllOrders = async (): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  } catch (error) {
    console.error('Error getting all orders:', error);
    throw new Error('Failed to get orders');
  }
};

/**
 * Subscribe to all orders in real-time (admin only)
 */
export const subscribeToAllOrders = (
  callback: (orders: Order[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        callback(orders);
      },
      (error) => {
        console.error('Error subscribing to orders:', error);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    console.error('Error setting up orders subscription:', error);
    throw new Error('Failed to subscribe to orders');
  }
};

/**
 * Subscribe to user's orders in real-time
 */
export const subscribeToUserOrders = (
  userId: string,
  callback: (orders: Order[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        callback(orders);
      },
      (error) => {
        console.error('Error subscribing to user orders:', error);
        if (onError) onError(error);
      }
    );
  } catch (error) {
    console.error('Error setting up user orders subscription:', error);
    throw new Error('Failed to subscribe to user orders');
  }
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: string,
  status: Order['status']
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const now = Timestamp.now();
    
    // Get current order to update status history
    const orderSnap = await getDoc(docRef);
    const currentData = orderSnap.data();
    const statusHistory = currentData?.statusHistory || [];
    
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [...statusHistory, { status, timestamp: now }],
    };

    // Generate OTP when status becomes outForDelivery (if not already present)
    if (status === 'outForDelivery' && !currentData?.delivery_otp) {
      const otp = generateOTP();
      updateData.delivery_otp = otp;
      updateData.otp_verified = false;
      updateData.otp_generated_at = now;
    }

    // Generate return_otp when status becomes returnScheduled (if not already present)
    if (status === 'returnScheduled' && !currentData?.return_otp) {
      updateData.return_otp = generateOTP();
      updateData.return_otp_verified = false;
      updateData.return_otp_generated_at = now;
    }
    // Ensure returnScheduledAt is set (needed to identify return-context 'picked')
    if (status === 'returnScheduled' && !currentData?.returnScheduledAt) {
      updateData.returnScheduledAt = now;
    }

    // Generate return_store_otp when manually moved to 'picked' in return context
    if (status === 'picked' && currentData?.returnScheduledAt && !currentData?.return_store_otp) {
      updateData.return_store_otp = generateOTP();
    }

    await updateDoc(docRef, updateData);

    // Restore stock when order is cancelled or returned — only if it was
    // previously decremented (flag prevents double-restore for old orders).
    if (
      (status === 'cancelled' || status === 'returned') &&
      currentData?.stockDecremented === true
    ) {
      try {
        const items = (currentData.items as OrderItem[]) || [];
        await Promise.all(
          items.map(item =>
            updateDoc(doc(db, 'products', item.productId), {
              'inventory.stock': increment(item.quantity),
            })
          )
        );
        await updateDoc(docRef, { stockDecremented: false });
      } catch (err) {
        console.warn('[orderService] stock restore failed:', err);
      }
    }

    // Notify customer (WhatsApp + push). Best effort — never blocks the write.
    void dispatchStatusNotifications(orderId, status, {
      phone: currentData?.shippingAddress?.mobile || currentData?.customerPhone,
      userPhone: currentData?.userPhone,
      customerName: currentData?.customerName || currentData?.shippingAddress?.fullName,
      items: currentData?.items as OrderItem[],
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Failed to update order status');
  }
};

/**
 * Update order tracking information (admin only)
 */
export interface TrackingUpdate {
  status: Order['status'];
  trackingId?: string;
  carrier?: string;
  trackingUrl?: string;
  note?: string;
}

export const updateOrderTracking = async (
  orderId: string,
  trackingData: TrackingUpdate
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const now = Timestamp.now();
    
    // Get current order to update status history
    const orderSnap = await getDoc(docRef);
    const currentData = orderSnap.data();
    const statusHistory = currentData?.statusHistory || [];
    
    const updateData: Record<string, unknown> = {
      status: trackingData.status,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...statusHistory, 
        { 
          status: trackingData.status, 
          timestamp: now,
          ...(trackingData.note && { note: trackingData.note })
        }
      ],
    };
    
    // Only add tracking fields if provided
    if (trackingData.trackingId !== undefined) {
      updateData.trackingId = trackingData.trackingId;
    }
    if (trackingData.carrier !== undefined) {
      updateData.carrier = trackingData.carrier;
    }
    if (trackingData.trackingUrl !== undefined) {
      updateData.trackingUrl = trackingData.trackingUrl;
    }

    // Generate OTP when status becomes outForDelivery (if not already present)
    if (trackingData.status === 'outForDelivery' && !currentData?.delivery_otp) {
      const otp = generateOTP();
      updateData.delivery_otp = otp;
      updateData.otp_verified = false;
      updateData.otp_generated_at = now;
      console.log('🔐 [OTP] Generated delivery OTP for order:', orderId);
    }
    
    console.log('🔄 [Update] Updating order tracking:', orderId);
    console.log('🔄 [Update] Update data:', updateData);
    await updateDoc(docRef, updateData);
    console.log('✅ [Update] Order tracking updated successfully');

    void dispatchStatusNotifications(orderId, trackingData.status, {
      phone: currentData?.shippingAddress?.mobile || currentData?.customerPhone,
      userPhone: currentData?.userPhone,
      customerName: currentData?.customerName || currentData?.shippingAddress?.fullName,
      items: currentData?.items as OrderItem[],
    });
  } catch (error) {
    console.error('❌ [Update] Error updating order tracking:', error);
    throw new Error('Failed to update order tracking');
  }
};

/**
 * Update entire order
 */
export const updateOrder = async (
  orderId: string,
  updates: Partial<OrderFormData>
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating order:', error);
    throw new Error('Failed to update order');
  }
};

/**
 * Delete an order (admin only)
 */
export const deleteOrder = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting order:', error);
    throw new Error('Failed to delete order');
  }
};

/**
 * Generate a unique order number
 */
export const generateOrderNumber = (): string => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Get order statistics (admin only)
 */
export const getOrderStats = async () => {
  try {
    const orders = await getAllOrders();
    
    const stats = {
      total: orders.length,
      pending: orders.filter(o => normalizeOrderStatus(o.status) === 'pending').length,
      processing: orders.filter(o => normalizeOrderStatus(o.status) === 'processing').length,
      packed: orders.filter(o => normalizeOrderStatus(o.status) === 'packed').length,
      outForDelivery: orders.filter(o => normalizeOrderStatus(o.status) === 'outForDelivery').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalRevenue: orders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, order) => sum + order.total, 0),
    };

    return stats;
  } catch (error) {
    console.error('Error getting order stats:', error);
    throw new Error('Failed to get order statistics');
  }
};

/**
 * Get orders assigned to a specific delivery boy
 */
export const getDeliveryBoyOrders = async (deliveryBoyId: string): Promise<Order[]> => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('delivery_boy_id', '==', deliveryBoyId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  } catch (error) {
    console.error('Error getting delivery boy orders:', error);
    throw new Error('Failed to get delivery boy orders');
  }
};

/**
 * Subscribe to orders assigned to a specific delivery boy in real-time
 */
export const subscribeToDeliveryBoyOrders = (
  deliveryBoyId: string,
  onUpdate: (orders: Order[]) => void,
  onError: (error: Error) => void
) => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where('delivery_boy_id', '==', deliveryBoyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        const orders: Order[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        onUpdate(orders);
      },
      (error) => {
        console.error('Error in delivery boy orders subscription:', error);
        onError(new Error(error.message || 'Failed to subscribe to orders'));
      }
    );

    return unsubscribe;
  } catch (error: unknown) {
    console.error('Error setting up delivery boy orders subscription:', error);
    onError(new Error(error instanceof Error ? error.message : 'Failed to subscribe to orders'));
    return () => {};
  }
};

/**
 * Assign an order to a delivery partner.
 *
 * In the simplified workflow, assigning a partner is the trigger for
 * "Out for Delivery" — the OTP is generated atomically and the customer
 * is notified via WhatsApp/push (best-effort) so they can share the OTP.
 */
export const assignOrderToDeliveryBoy = async (
  orderId: string,
  deliveryBoyId: string,
  deliveryBoyName: string,
  deliveryBoyPhone?: string,
): Promise<{ otp: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(docRef);
    const currentData = orderSnap.data() || {};
    const existingHistory = currentData.statusHistory || [];
    const now = Timestamp.now();

    // Generate OTP unless one is already pending verification.
    const otp =
      currentData.delivery_otp && currentData.otp_verified === false
        ? (currentData.delivery_otp as string)
        : generateOTP();

    const updateData: Record<string, unknown> = {
      // Legacy fields kept in sync with new canonical names.
      delivery_boy_id: deliveryBoyId,
      delivery_boy_name: deliveryBoyName,
      delivery_partner_id: deliveryBoyId,
      delivery_partner_name: deliveryBoyName,
      deliveryBoyId,
      assignedAt: now,
      status: 'outForDelivery',
      delivery_otp: otp,
      otp_verified: false,
      otp_generated_at: now,
      updatedAt: now,
      lastUpdated: now,
      outForDeliveryAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'outForDelivery',
          timestamp: now,
          note: `Assigned to ${deliveryBoyName} • Out for delivery`,
        },
      ],
    };

    if (deliveryBoyPhone) {
      updateData.delivery_partner_phone = deliveryBoyPhone;
    }

    await updateDoc(docRef, updateData);

    // Best-effort customer notification (WhatsApp + push).
    void dispatchStatusNotifications(orderId, 'outForDelivery', {
      phone: currentData.shippingAddress?.mobile,
      userPhone: currentData.userPhone,
      customerName: currentData.shippingAddress?.fullName || currentData.userName,
      items: currentData.items as OrderItem[],
    });

    // Notify the assigned delivery partner that they have a new pickup.
    void notifyOrder({
      orderId,
      audience: 'delivery',
      title: 'New delivery assigned',
      body: `Order ${shortOrderRef(orderId)} is ready for pickup.`,
      url: `/delivery/orders/${orderId}`,
      data: { type: 'delivery-assigned' },
    });

    // WhatsApp template to the delivery partner (if phone is known).
    if (deliveryBoyPhone) {
      const deliveryAddress = [
        currentData.shippingAddress?.address,
        currentData.shippingAddress?.locality,
        currentData.shippingAddress?.city,
      ]
        .filter(Boolean)
        .join(', ');
      void sendDeliveryAssignedTemplate({
        to: normalizePhoneNumber(deliveryBoyPhone),
        partnerName: deliveryBoyName,
        orderId,
        deliveryAddress: deliveryAddress || 'address in app',
        itemsSummary: makeItemsSummary(currentData.items as OrderItem[]),
      });
    }

    return { otp };
  } catch (error) {
    console.error('Error assigning order to delivery partner:', error);
    throw new Error('Failed to assign delivery partner');
  }
};

/** Backward-compatible alias for the new naming. */
export const assignDeliveryPartner = assignOrderToDeliveryBoy;

/**
 * Update delivery status by delivery boy
 */
export const updateDeliveryStatusByDeliveryBoy = async (
  orderId: string,
  status: Order['status'],
  note?: string
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const now = Timestamp.now();
    const existingHistory = orderDoc.data()?.statusHistory || [];
    
    // Build update object - only include defined values
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status,
          timestamp: now,
          ...(note && { note }),
        },
      ],
    };

    // Generate OTP when status changes to outForDelivery
    if (status === 'outForDelivery') {
      const otp = generateOTP();
      updateData.delivery_otp = otp;
      updateData.otp_verified = false;
      updateData.otp_generated_at = now;
    }

    await updateDoc(docRef, updateData);

    // Best-effort customer notification (WhatsApp + push).
    const data = orderDoc.data() || {};
    void dispatchStatusNotifications(orderId, status, {
      phone: data.shippingAddress?.mobile || data.customerPhone,
      userPhone: data.userPhone,
      customerName: data.shippingAddress?.fullName || data.userName,
      items: data.items as OrderItem[],
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    throw new Error('Failed to update delivery status');
  }
};

/**
 * Generate a random 4-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Verify delivery OTP and mark as delivered
 */
export const verifyDeliveryOTP = async (
  orderId: string,
  inputOtp: string,
  deliveryBoyId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      return { success: false, message: 'Order not found' };
    }

    const orderData = orderDoc.data();
    
    // Security check: Ensure the delivery boy is assigned to this order
    if (orderData.delivery_boy_id !== deliveryBoyId) {
      return { success: false, message: 'You are not authorized for this delivery' };
    }

    // Check if order is in correct status
    if (orderData.status !== 'outForDelivery') {
      return { success: false, message: 'Order is not out for delivery' };
    }

    // Require a saved delivery window before allowing OTP verification
    if (!orderData.delivery_window_date || !orderData.delivery_window_from || !orderData.delivery_window_to) {
      return { success: false, message: 'Set a delivery window before completing this delivery.' };
    }

    if (isCashOnDeliveryOrder(orderData as Pick<Order, 'paymentMethod'>) && !isPaymentSettled(orderData as Pick<Order, 'paymentMethod' | 'paymentStatus'>)) {
      return { success: false, message: 'Collect and mark the COD payment before completing this delivery.' };
    }

    // Verify OTP
    if (orderData.delivery_otp !== inputOtp) {
      return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    // OTP is correct - update order to delivered
    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    
    // Clean update - remove OTP field by setting to deleteField or null
    await updateDoc(docRef, {
      status: 'delivered',
      otp_verified: true,
      delivery_otp: null, // Clear OTP after successful verification
      updatedAt: now,
      lastUpdated: now,
      deliveredAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'delivered',
          timestamp: now,
          note: 'Delivered successfully - OTP verified',
        },
      ],
    });

    // Notify the customer that their order was delivered (push + WhatsApp).
    void dispatchStatusNotifications(orderId, 'delivered', {
      phone: orderData.shippingAddress?.mobile || orderData.customerPhone,
      userPhone: orderData.userPhone,
      customerName: orderData.shippingAddress?.fullName || orderData.userName,
      items: orderData.items as OrderItem[],
    });

    return { success: true, message: 'Delivery confirmed successfully!' };
  } catch (error) {
    console.error('Error verifying delivery OTP:', error);
    return { success: false, message: 'Failed to verify OTP. Please try again.' };
  }
};

/**
 * Mark a COD order as paid by the assigned delivery partner.
 * This persists the collection event so admin/customer views stop inferring
 * payment state from the method string alone.
 */
export const markCODPaymentCollected = async (
  orderId: string,
  collectorId: string,
  collectorName?: string,
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);

    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data() as Partial<Order>;
    const assignedId = orderData.delivery_partner_id || orderData.delivery_boy_id;

    if (assignedId !== collectorId) {
      throw new Error('You are not assigned to this order');
    }
    if (!isCashOnDeliveryOrder(orderData as Pick<Order, 'paymentMethod'>)) {
      throw new Error('This order is not a cash on delivery order');
    }
    if (orderData.status !== 'outForDelivery') {
      throw new Error('COD payment can only be collected while the order is out for delivery');
    }
    if (isPaymentSettled(orderData as Pick<Order, 'paymentMethod' | 'paymentStatus'>)) {
      return;
    }

    const now = Timestamp.now();
    const statusHistory = orderData.statusHistory || [];
    await updateDoc(docRef, {
      paymentStatus: 'paid',
      paymentCollectedAt: now,
      paymentCollectedBy: collectorId,
      paymentCollectedByName: collectorName || 'Delivery partner',
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...statusHistory,
        {
          status: orderData.status || 'outForDelivery',
          timestamp: now,
          note: `COD payment collected by ${collectorName || 'delivery partner'}`,
        },
      ],
    });
  } catch (error: unknown) {
    console.error('Error marking COD payment collected:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to mark COD payment collected');
  }
};

/**
 * Assign a delivery partner for return pickup.
 * Sets status → 'returnScheduled', generates a return_otp, stores partner fields.
 */
export const assignReturnPickupPartner = async (
  orderId: string,
  deliveryBoyId: string,
  deliveryBoyName: string,
  deliveryBoyPhone?: string,
): Promise<{ otp: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(docRef);
    if (!orderSnap.exists()) throw new Error('Order not found');
    const currentData = orderSnap.data() || {};
    // Block assignment unless the return has been explicitly approved.
    // This prevents admins from skipping the approval step and silently
    // dispatching a pickup partner.
    if (currentData.returnStatus !== 'approved') {
      throw new Error('Approve the return request before assigning a pickup partner.');
    }
    const existingHistory = currentData.statusHistory || [];
    const now = Timestamp.now();
    const otp = generateOTP();

    const updateData: Record<string, unknown> = {
      delivery_boy_id: deliveryBoyId,
      delivery_boy_name: deliveryBoyName,
      delivery_partner_id: deliveryBoyId,
      delivery_partner_name: deliveryBoyName,
      deliveryBoyId,
      status: 'returnScheduled',
      return_otp: otp,
      return_otp_verified: false,
      return_otp_generated_at: now,
      returnScheduledAt: now,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'returnScheduled',
          timestamp: now,
          note: `Return pickup assigned to ${deliveryBoyName}`,
        },
      ],
    };

    if (deliveryBoyPhone) {
      updateData.delivery_partner_phone = deliveryBoyPhone;
    }

    await updateDoc(docRef, updateData);

    // Notify customer + the assigned return-pickup partner.
    void dispatchStatusNotifications(orderId, 'returnScheduled', {
      phone: currentData.shippingAddress?.mobile,
      userPhone: currentData.userPhone,
      customerName: currentData.shippingAddress?.fullName || currentData.userName,
      items: currentData.items as OrderItem[],
    });
    void notifyOrder({
      orderId,
      audience: 'delivery',
      title: 'Return pickup assigned',
      body: `Order ${shortOrderRef(orderId)} is scheduled for return pickup.`,
      url: `/delivery/orders/${orderId}`,
      data: { type: 'return-assigned' },
    });

    // WhatsApp template to the delivery partner (if phone is known).
    if (deliveryBoyPhone) {
      const deliveryAddress = [
        currentData.shippingAddress?.address,
        currentData.shippingAddress?.locality,
        currentData.shippingAddress?.city,
      ]
        .filter(Boolean)
        .join(', ');
      void sendDeliveryAssignedTemplate({
        to: normalizePhoneNumber(deliveryBoyPhone),
        partnerName: deliveryBoyName,
        orderId,
        deliveryAddress: deliveryAddress || 'address in app',
        itemsSummary: makeItemsSummary(currentData.items as OrderItem[]),
      });
    }

    return { otp };
  } catch (error: unknown) {
    console.error('Error assigning return pickup partner:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to assign return pickup partner');
  }
};

/**
 * Verify return pickup OTP and mark return as picked.
 * Customer shows the return_otp; delivery partner enters it to confirm pickup.
 */
export const verifyReturnPickupOTP = async (
  orderId: string,
  inputOtp: string,
  deliveryBoyId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    if (!orderDoc.exists()) return { success: false, message: 'Order not found' };

    const orderData = orderDoc.data();
    const assignedId = orderData.delivery_partner_id || orderData.delivery_boy_id;

    if (assignedId !== deliveryBoyId) {
      return { success: false, message: 'You are not authorized for this pickup' };
    }
    if (orderData.status !== 'returnScheduled') {
      return { success: false, message: 'Order is not scheduled for return pickup' };
    }
    if (!orderData.return_window_date || !orderData.return_window_from || !orderData.return_window_to) {
      return { success: false, message: 'Set a return pickup window before collecting this item.' };
    }
    if (orderData.return_otp !== inputOtp) {
      return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    const storeOtp = generateOTP();
    await updateDoc(docRef, {
      status: 'picked',
      return_otp_verified: true,
      return_otp: null,
      return_store_otp: storeOtp,
      updatedAt: now,
      lastUpdated: now,
      pickedAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'picked',
          timestamp: now,
          note: 'Return item picked up — OTP verified',
        },
      ],
    });
    return { success: true, message: 'Return pickup confirmed!' };
  } catch (error) {
    console.error('Error verifying return pickup OTP:', error);
    return { success: false, message: 'Failed to verify OTP. Please try again.' };
  }
};

/**
 * Verify return-to-store OTP (admin tells partner) and mark order as returned.
 */
export const verifyReturnToStoreOTP = async (
  orderId: string,
  inputOtp: string,
  deliveryBoyId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    if (!orderDoc.exists()) return { success: false, message: 'Order not found' };

    const orderData = orderDoc.data();
    const assignedId = orderData.delivery_partner_id || orderData.delivery_boy_id;

    if (assignedId !== deliveryBoyId) {
      return { success: false, message: 'You are not authorized for this return' };
    }
    const isReturnContext =
      (orderData.status === 'picked' && !!orderData.returnScheduledAt) ||
      orderData.status === 'deliveryFailed';
    if (!isReturnContext) {
      return { success: false, message: 'Order is not awaiting return confirmation' };
    }
    if (orderData.return_store_otp !== inputOtp) {
      return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    await updateDoc(docRef, {
      status: 'returned',
      return_store_otp: null,
      return_store_otp_verified: true,
      updatedAt: now,
      lastUpdated: now,
      returnedAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'returned',
          timestamp: now,
          note: 'Item returned to store — OTP verified',
        },
      ],
    });
    return { success: true, message: 'Return to store confirmed!' };
  } catch (error) {
    console.error('Error verifying return-to-store OTP:', error);
    return { success: false, message: 'Failed to verify OTP. Please try again.' };
  }
};

/**
 * Accept order by delivery boy (status: shipped/assigned/processing -> picked)
 */
export const acceptOrderByDeliveryBoy = async (
  orderId: string,
  deliveryBoyId: string
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data();
    
    // Security check
    if (orderData.delivery_boy_id !== deliveryBoyId) {
      throw new Error('You are not authorized for this order');
    }

    // Valid statuses for accepting: shipped, assigned, processing
    const validStatuses = ['shipped', 'assigned', 'processing'];
    if (!validStatuses.includes(orderData.status)) {
      throw new Error(`Order cannot be accepted in current status: ${orderData.status}`);
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    
    await updateDoc(docRef, {
      status: 'picked',
      updatedAt: now,
      lastUpdated: now,
      pickedAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'picked',
          timestamp: now,
          note: 'Order picked up by delivery partner',
        },
      ],
    });
  } catch (error) {
    console.error('Error accepting order:', error);
    throw error; // Re-throw the original error for better debugging
  }
};

/**
 * Start delivery (status: picked -> outForDelivery + generate OTP)
 */
export const startDelivery = async (
  orderId: string,
  deliveryBoyId: string
): Promise<string> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data();
    
    // Security check
    if (orderData.delivery_boy_id !== deliveryBoyId) {
      throw new Error('You are not authorized for this order');
    }

    if (orderData.status !== 'picked' && orderData.status !== 'shipped' && orderData.status !== 'assigned') {
      throw new Error('Order cannot start delivery in current status');
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    const otp = generateOTP();
    
    await updateDoc(docRef, {
      status: 'outForDelivery',
      delivery_otp: otp,
      otp_verified: false,
      otp_generated_at: now,
      updatedAt: now,
      lastUpdated: now,
      outForDeliveryAt: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'outForDelivery',
          timestamp: now,
          note: 'Out for delivery - OTP generated',
        },
      ],
    });

    return otp; // Return OTP for confirmation (delivery boy sees this)
  } catch (error) {
    console.error('Error starting delivery:', error);
    throw new Error('Failed to start delivery');
  }
};

/**
 * Unassign order from delivery boy
 */
export const unassignOrderFromDeliveryBoy = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const now = Timestamp.now();
    
    await updateDoc(docRef, {
      delivery_boy_id: null,
      delivery_boy_name: null,
      assignedAt: null,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error unassigning order from delivery boy:', error);
    throw new Error('Failed to unassign order');
  }
};

/**
 * Cancel an order (only for pending/processing status)
 */
export const cancelOrder = async (
  orderId: string,
  userId: string,
  cancellationReason: string
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data() as Order;
    
    // Validate user ownership
    if (orderData.userId !== userId) {
      throw new Error('Unauthorized to cancel this order');
    }

    // Only allow cancellation for pending or processing orders
    if (orderData.status !== 'pending' && orderData.status !== 'processing') {
      throw new Error('Order cannot be cancelled in current status');
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];

    await updateDoc(docRef, {
      status: 'cancelled',
      cancellationReason,
      cancelledAt: now,
      cancelledBy: 'user',
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'cancelled',
          timestamp: now,
          note: `Cancelled by user - Reason: ${cancellationReason}`,
        },
      ],
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

/**
 * Request a return for a delivered order (within 7 days)
 */
export const requestReturn = async (
  orderId: string,
  userId: string,
  returnReason: string
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data() as Order;
    
    // Validate user ownership
    if (orderData.userId !== userId) {
      throw new Error('Unauthorized to request return for this order');
    }

    // Only allow return for delivered orders
    if (orderData.status !== 'delivered') {
      throw new Error('Only delivered orders can be returned');
    }

    // Check if delivered within 7 days (168 hours)
    if (orderData.deliveredAt) {
      const deliveredDate = orderData.deliveredAt.toDate();
      const now = new Date();
      const hoursSinceDelivery = (now.getTime() - deliveredDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceDelivery > 168) {
        throw new Error('Return window has expired. Returns are only accepted within 7 days of delivery.');
      }
    }

    const timestamp = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];

    await updateDoc(docRef, {
      status: 'returnRequested',
      returnReason,
      returnRequestedAt: timestamp,
      returnStatus: 'pending',
      updatedAt: timestamp,
      lastUpdated: timestamp,
      statusHistory: [
        ...existingHistory,
        {
          status: 'returnRequested',
          timestamp,
          note: `Return requested - Reason: ${returnReason}`,
        },
      ],
    });

    // Notify admin via WhatsApp that a return was requested
    void (async () => {
      const adminPhone = await getAdminNotificationPhone();
      if (adminPhone) {
        void sendAdminNewOrderTemplate({
          to: normalizePhoneNumber(adminPhone),
          orderId,
          total: orderData.total || 0,
          customerName: orderData.userName || 'Customer',
          itemsSummary: `Return requested: ${makeItemsSummary(orderData.items as OrderItem[])}`,
        });
      }
    })();
  } catch (error) {
    console.error('Error requesting return:', error);
    throw error;
  }
};

/**
 * Approve return request (Admin only).
 *
 * IMPORTANT: This only marks `returnStatus: 'approved'` — it does NOT advance
 * the order status. The status only moves to `returnScheduled` once an admin
 * actually assigns a pickup partner via `assignReturnPickupPartner`. This
 * prevents a customer from being told "scheduled" when nobody has been
 * dispatched yet.
 */
export const approveReturn = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);

    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data() as Order;

    if (orderData.status !== 'returnRequested') {
      throw new Error('Order is not in return requested status');
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];

    await updateDoc(docRef, {
      // Keep status at 'returnRequested' so the partner-assignment UI stays visible.
      returnStatus: 'approved',
      returnApprovedAt: now,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'returnRequested',
          timestamp: now,
          note: 'Return approved by admin — awaiting pickup partner assignment',
        },
      ],
    });

    // Notify the customer that their return request was approved.
    const notifyPhone = orderData.userPhone || orderData.shippingAddress?.mobile;
    if (notifyPhone) {
      void sendReturnUpdateTemplate({
        to: normalizePhoneNumber(notifyPhone),
        customerName: orderData.shippingAddress?.fullName || orderData.userName || 'Customer',
        orderId,
        result: 'approved',
        itemsSummary: makeItemsSummary(orderData.items as OrderItem[]),
      });
    }
    void notifyOrder({
      orderId,
      audience: 'customer',
      title: 'Return approved',
      body: `Your return request for order ${shortOrderRef(orderId)} has been approved. A pickup will be scheduled soon.`,
      url: `/account/orders/${orderId}`,
      data: { type: 'return-approved' },
    });
  } catch (error) {
    console.error('Error approving return:', error);
    throw error;
  }
};

/**
 * Reject return request (Admin only)
 */
export const rejectReturn = async (orderId: string): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Order not found');
    }

    const orderData = orderDoc.data() as Order;

    if (orderData.status !== 'returnRequested') {
      throw new Error('Order is not in return requested status');
    }

    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];

    await updateDoc(docRef, {
      status: 'delivered', // Revert back to delivered
      returnStatus: 'rejected',
      returnRejectedAt: now,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'delivered',
          timestamp: now,
          note: 'Return request rejected by admin',
        },
      ],
    });

    // Notify the customer that their return request was rejected.
    const notifyPhone = orderData.userPhone || orderData.shippingAddress?.mobile;
    if (notifyPhone) {
      void sendReturnUpdateTemplate({
        to: normalizePhoneNumber(notifyPhone),
        customerName: orderData.shippingAddress?.fullName || orderData.userName || 'Customer',
        orderId,
        result: 'rejected',
        itemsSummary: makeItemsSummary(orderData.items as OrderItem[]),
      });
    }
    void notifyOrder({
      orderId,
      audience: 'customer',
      title: 'Return request rejected',
      body: `Your return request for order ${shortOrderRef(orderId)} has been rejected. Please contact support for help.`,
      url: `/account/orders/${orderId}`,
      data: { type: 'return-rejected' },
    });
  } catch (error) {
    console.error('Error rejecting return:', error);
    throw error;
  }
};

/**
 * Cancel a pending return request (customer action — one-time only).
 * Reverts the order back to `delivered` and sets `returnCancelled: true` so
 * the Return button is permanently hidden for this order.
 */
export const cancelReturn = async (orderId: string): Promise<void> => {
  const docRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderDoc = await getDoc(docRef);
  if (!orderDoc.exists()) throw new Error('Order not found');
  const orderData = orderDoc.data() as Order;
  if (orderData.status !== 'returnRequested') {
    throw new Error('Return can only be cancelled while it is still in the requested state');
  }
  const now = Timestamp.now();
  const existingHistory = orderData.statusHistory || [];
  await updateDoc(docRef, {
    status: 'delivered',
    returnCancelled: true,
    returnCancelledAt: now,
    return_otp: null,
    return_otp_verified: null,
    updatedAt: now,
    lastUpdated: now,
    statusHistory: [
      ...existingHistory,
      { status: 'delivered', timestamp: now, note: 'Return cancelled by customer' },
    ],
  });
};

/**
 * Set (or update) a delivery window for an order.
 * Can be called by admin or delivery partner — no status change.
 * Sends a WhatsApp time-slot notification to the customer.
 */
export const setDeliveryWindow = async (
  orderId: string,
  window: { date: string; from: string; to: string; note?: string },
): Promise<void> => {
  const docRef = doc(db, ORDERS_COLLECTION, orderId);
  const now = Timestamp.now();
  const orderSnap = await getDoc(docRef);
  const od = orderSnap.data() || {};
  await updateDoc(docRef, {
    delivery_window_date: window.date,
    delivery_window_from: window.from,
    delivery_window_to: window.to,
    delivery_window_note: window.note ?? '',
    updatedAt: now,
    lastUpdated: now,
  });
  // Notify customer of the scheduled time slot
  const notifyPhone = od.userPhone || od.shippingAddress?.mobile;
  if (notifyPhone) {
    void sendTimeslotTemplate({
      to: normalizePhoneNumber(notifyPhone),
      customerName: od.customerName || od.shippingAddress?.fullName || 'Customer',
      orderId,
      date: window.date,
      timeRange: `${window.from} – ${window.to}`,
    });
  }
};

/**
 * Set (or update) a return-pickup window for an order. Mirrors setDeliveryWindow
 * but writes to the `return_window_*` fields used by the return pickup flow.
 * Sends a WhatsApp time-slot notification to the customer.
 */
export const setReturnPickupWindow = async (
  orderId: string,
  window: { date: string; from: string; to: string; note?: string },
): Promise<void> => {
  const docRef = doc(db, ORDERS_COLLECTION, orderId);
  const now = Timestamp.now();
  const orderSnap = await getDoc(docRef);
  const od = orderSnap.data() || {};
  await updateDoc(docRef, {
    return_window_date: window.date,
    return_window_from: window.from,
    return_window_to: window.to,
    return_window_note: window.note ?? '',
    updatedAt: now,
    lastUpdated: now,
  });
  // Notify customer of the scheduled return-pickup time slot
  const notifyPhone = od.userPhone || od.shippingAddress?.mobile;
  if (notifyPhone) {
    void sendTimeslotTemplate({
      to: normalizePhoneNumber(notifyPhone),
      customerName: od.customerName || od.shippingAddress?.fullName || 'Customer',
      orderId,
      date: window.date,
      timeRange: `${window.from} – ${window.to}`,
    });
  }
};

/**
 * Predefined fulfillment-window templates shared by delivery and return-pickup
 * flows. Each template returns a concrete `{date, from, to}` based on the
 * current local time.
 */
export type FulfillmentWindowTemplateId =
  | 'today-morning'
  | 'today-afternoon'
  | 'today-evening'
  | 'tomorrow-morning'
  | 'tomorrow-afternoon'
  | 'tomorrow-evening';

export interface FulfillmentWindowTemplate {
  id: FulfillmentWindowTemplateId;
  label: string;        // e.g. "Today · Morning"
  shortLabel: string;   // e.g. "Today AM"
  from: string;         // 'HH:mm'
  to: string;           // 'HH:mm'
  dayOffset: 0 | 1;
}

export const FULFILLMENT_WINDOW_TEMPLATES: FulfillmentWindowTemplate[] = [
  { id: 'today-morning',     label: 'Today · Morning (9–12)',     shortLabel: 'Today AM',    from: '09:00', to: '12:00', dayOffset: 0 },
  { id: 'today-afternoon',   label: 'Today · Afternoon (12–4)',   shortLabel: 'Today PM',    from: '12:00', to: '16:00', dayOffset: 0 },
  { id: 'today-evening',     label: 'Today · Evening (4–8)',      shortLabel: 'Today Eve',   from: '16:00', to: '20:00', dayOffset: 0 },
  { id: 'tomorrow-morning',  label: 'Tomorrow · Morning (9–12)',  shortLabel: 'Tom AM',      from: '09:00', to: '12:00', dayOffset: 1 },
  { id: 'tomorrow-afternoon',label: 'Tomorrow · Afternoon (12–4)',shortLabel: 'Tom PM',      from: '12:00', to: '16:00', dayOffset: 1 },
  { id: 'tomorrow-evening',  label: 'Tomorrow · Evening (4–8)',   shortLabel: 'Tom Eve',     from: '16:00', to: '20:00', dayOffset: 1 },
];

/**
 * Resolve a template into a concrete window with an ISO date. Uses the local
 * timezone — slot dates always render as the partner's wall-clock date.
 */
export const resolveFulfillmentWindowTemplate = (
  template: FulfillmentWindowTemplate,
  reference: Date = new Date(),
): { date: string; from: string; to: string } => {
  const target = new Date(reference);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + template.dayOffset);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    from: template.from,
    to: template.to,
  };
};

/**
 * Delivery partner marks "Customer Unavailable" — starts the failed-delivery return flow.
 * Generates a `return_store_otp` the partner will enter at the store.
 */
export const startFailedDeliveryReturn = async (
  orderId: string,
  deliveryBoyId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderDoc = await getDoc(docRef);
    if (!orderDoc.exists()) return { success: false, message: 'Order not found' };
    const orderData = orderDoc.data();
    const assignedId = orderData.delivery_partner_id || orderData.delivery_boy_id;
    if (assignedId !== deliveryBoyId) {
      return { success: false, message: 'You are not assigned to this order' };
    }
    // Must be in outForDelivery (or legacy picked non-return context)
    const normalStatus = normalizeOrderStatus(orderData.status);
    if (normalStatus !== 'outForDelivery') {
      return { success: false, message: 'Order must be out for delivery to start return' };
    }
    const now = Timestamp.now();
    const existingHistory = orderData.statusHistory || [];
    const storeOtp = generateOTP();
    await updateDoc(docRef, {
      status: 'deliveryFailed',
      return_store_otp: storeOtp,
      deliveryFailedAt: now,
      deliveryFailureReason: reason || 'Customer unavailable',
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'deliveryFailed',
          timestamp: now,
          note: reason ? `Delivery failed: ${reason}` : 'Delivery failed: Customer unavailable',
        },
      ],
    });
    return { success: true, message: 'Return journey started. Bring the item back to store.' };
  } catch (error) {
    console.error('Error starting failed delivery return:', error);
    return { success: false, message: 'Failed to start return. Please try again.' };
  }
};
