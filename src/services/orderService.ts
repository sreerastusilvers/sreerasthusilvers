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
  DocumentData
} from 'firebase/firestore';
import { db } from '@/config/firebase';

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
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  taxAmount: number;
  discount: number;
  total: number;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  status: 'pending' | 'processing' | 'shipped' | 'assigned' | 'picked' | 'outForDelivery' | 'delivered' | 'cancelled' | 'returnRequested' | 'returnScheduled' | 'returned';
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
  // Delivery assignment fields
  delivery_boy_id?: string;
  delivery_boy_name?: string;
  assignedAt?: Timestamp;
  deliveryNotes?: string;
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
  deliveredAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OrderFormData = Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;

const ORDERS_COLLECTION = 'orders';

/**
 * Create a new order
 */
export const createOrder = async (orderData: OrderFormData): Promise<string> => {
  try {
    const now = Timestamp.now();
    const orderWithTimestamps = {
      ...orderData,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, ORDERS_COLLECTION), orderWithTimestamps);
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
    
    const updateData: Record<string, any> = {
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
    
    await updateDoc(docRef, updateData);
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
    
    const updateData: Record<string, any> = {
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
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      outForDelivery: orders.filter(o => o.status === 'outForDelivery').length,
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
  } catch (error: any) {
    console.error('Error setting up delivery boy orders subscription:', error);
    onError(new Error(error.message || 'Failed to subscribe to orders'));
    return () => {};
  }
};

/**
 * Assign an order to a delivery boy
 */
export const assignOrderToDeliveryBoy = async (
  orderId: string,
  deliveryBoyId: string,
  deliveryBoyName: string
): Promise<void> => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, orderId);
    const now = Timestamp.now();
    
    await updateDoc(docRef, {
      delivery_boy_id: deliveryBoyId,
      delivery_boy_name: deliveryBoyName,
      assignedAt: now,
      updatedAt: now,
      statusHistory: [{
        status: 'assigned',
        timestamp: now,
        note: `Order assigned to ${deliveryBoyName}`,
      }],
    });
  } catch (error) {
    console.error('Error assigning order to delivery boy:', error);
    throw new Error('Failed to assign order');
  }
};

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
    const updateData: Record<string, any> = {
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

    return { success: true, message: 'Delivery confirmed successfully!' };
  } catch (error) {
    console.error('Error verifying delivery OTP:', error);
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
  } catch (error) {
    console.error('Error requesting return:', error);
    throw error;
  }
};

/**
 * Approve return request (Admin only)
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
      status: 'returnScheduled',
      returnStatus: 'approved',
      returnApprovedAt: now,
      updatedAt: now,
      lastUpdated: now,
      statusHistory: [
        ...existingHistory,
        {
          status: 'returnScheduled',
          timestamp: now,
          note: 'Return approved by admin',
        },
      ],
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
  } catch (error) {
    console.error('Error rejecting return:', error);
    throw error;
  }
};
