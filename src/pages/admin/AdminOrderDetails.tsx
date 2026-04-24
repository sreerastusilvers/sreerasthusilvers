import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BellRing,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Send,
  ShieldCheck,
  Truck,
  User,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToDeliveryBoys, DeliveryBoy } from '@/services/deliveryBoyService';
import {
  assignOrderToDeliveryBoy,
  Order,
  subscribeToOrder,
  TrackingUpdate,
  updateOrderStatus,
  updateOrderTracking,
} from '@/services/orderService';
import {
  createOrderMessage,
  OrderMessage,
  OrderMessageChannel,
  sendOrderPushMessage,
  sendOrderWhatsAppMessage,
  subscribeToOrderMessages,
} from '@/services/orderMessagingService';

const ORDER_STATUS_OPTIONS: Array<{ value: Order['status']; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked', label: 'Picked Up' },
  { value: 'outForDelivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returnRequested', label: 'Return Requested' },
  { value: 'returnScheduled', label: 'Return Scheduled' },
  { value: 'returned', label: 'Returned' },
];

const CHANNEL_OPTIONS: Array<{ value: OrderMessageChannel; label: string }> = [
  { value: 'note', label: 'Internal note' },
  { value: 'chat', label: 'In-app chat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'push', label: 'Web push' },
];

const QUICK_MESSAGE_PRESETS = [
  'Please confirm a suitable time slot for delivery today.',
  'Your order is packed and ready for dispatch. We will share the next update shortly.',
  'Our delivery partner will contact you before arrival. Please keep your phone reachable.',
];

const formatPrice = (price: number) => `₹${price.toLocaleString('en-IN')}`;

const formatDateTime = (value: any) => {
  if (!value) return 'N/A';
  const date = value.toDate ? value.toDate() : new Date((value.seconds || 0) * 1000);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusLabel = (status: Order['status']) =>
  ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const getStatusBadgeClass = (status: Order['status']) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    case 'processing':
    case 'assigned':
    case 'picked':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    case 'shipped':
    case 'outForDelivery':
      return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'cancelled':
    case 'returned':
      return 'bg-red-100 text-red-700 hover:bg-red-100';
    case 'returnRequested':
    case 'returnScheduled':
      return 'bg-orange-100 text-orange-700 hover:bg-orange-100';
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
  }
};

const getMessageChannelBadgeClass = (channel: OrderMessageChannel) => {
  switch (channel) {
    case 'chat':
      return 'bg-sky-100 text-sky-700 hover:bg-sky-100';
    case 'whatsapp':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'push':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    case 'system':
      return 'bg-purple-100 text-purple-700 hover:bg-purple-100';
    default:
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
  }
};

const AdminOrderDetails = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { user, userProfile } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusValue, setStatusValue] = useState<Order['status']>('pending');
  const [trackingStatus, setTrackingStatus] = useState<Order['status']>('pending');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [trackingNote, setTrackingNote] = useState('');
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState('');
  const [messageChannel, setMessageChannel] = useState<OrderMessageChannel>('note');
  const [messageTitle, setMessageTitle] = useState('Order update from Sree Rasthu Silvers');
  const [messageBody, setMessageBody] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [assigningPartner, setAssigningPartner] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const adminName = userProfile?.username || userProfile?.name || user?.displayName || 'Admin Desk';
  const adminAuthorId = user?.uid;

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrder(
      orderId,
      (nextOrder) => {
        setOrder(nextOrder);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to order:', error);
        toast.error('Failed to load order details');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = subscribeToOrderMessages(
      orderId,
      (nextMessages) => setMessages(nextMessages),
      () => toast.error('Failed to load the order conversation'),
    );

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    const unsubscribe = subscribeToDeliveryBoys(
      (boys) => setDeliveryBoys(boys.filter((boy) => boy.isActive)),
      (error) => console.error('Error loading delivery partners:', error),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!order) return;
    setStatusValue(order.status);
    setTrackingStatus(order.status);
    setTrackingUrl(order.trackingUrl || '');
    setSelectedDeliveryBoyId(order.delivery_boy_id || '');
  }, [order]);

  const handleStatusSave = async () => {
    if (!order) return;

    setSavingStatus(true);
    try {
      await updateOrderStatus(order.id, statusValue);
      await createOrderMessage(order.id, {
        authorType: 'system',
        authorId: adminAuthorId,
        authorName: adminName,
        channel: 'system',
        visibility: 'customer',
        message: `Status changed to ${getStatusLabel(statusValue)}.`,
      });
      toast.success(`Order status updated to ${getStatusLabel(statusValue)}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleTrackingSave = async () => {
    if (!order) return;

    setSavingTracking(true);
    try {
      const trackingData: TrackingUpdate = {
        status: trackingStatus,
        trackingUrl: trackingUrl || undefined,
        note: trackingNote || undefined,
      };

      await updateOrderTracking(order.id, trackingData);
      await createOrderMessage(order.id, {
        authorType: 'system',
        authorId: adminAuthorId,
        authorName: adminName,
        channel: 'system',
        visibility: 'customer',
        message: trackingNote
          ? `Tracking updated: ${trackingNote}`
          : `Tracking moved to ${getStatusLabel(trackingStatus)}.`,
        metadata: trackingUrl ? { trackingUrl } : undefined,
      });
      setTrackingNote('');
      toast.success('Tracking details updated');
    } catch (error) {
      console.error('Error updating tracking:', error);
      toast.error('Failed to update tracking details');
    } finally {
      setSavingTracking(false);
    }
  };

  const handleAssignPartner = async () => {
    if (!order || !selectedDeliveryBoyId) {
      toast.error('Select a delivery partner first');
      return;
    }

    const selectedPartner = deliveryBoys.find((boy) => boy.id === selectedDeliveryBoyId);
    if (!selectedPartner) {
      toast.error('Delivery partner record is unavailable');
      return;
    }

    setAssigningPartner(true);
    try {
      await assignOrderToDeliveryBoy(order.id, selectedPartner.id, selectedPartner.name);

      if (order.status === 'pending') {
        await updateOrderStatus(order.id, 'processing');
      }

      await createOrderMessage(order.id, {
        authorType: 'system',
        authorId: adminAuthorId,
        authorName: adminName,
        channel: 'system',
        visibility: 'customer',
        message:
          order.status === 'pending'
            ? `Assigned to ${selectedPartner.name} and moved to Processing.`
            : `Assigned to ${selectedPartner.name}.`,
      });

      toast.success(`Assigned to ${selectedPartner.name}`);
    } catch (error) {
      console.error('Error assigning delivery partner:', error);
      toast.error('Failed to assign delivery partner');
    } finally {
      setAssigningPartner(false);
    }
  };

  const handleSendMessage = async () => {
    if (!order || !messageBody.trim()) {
      toast.error('Write a message before sending');
      return;
    }

    setSendingMessage(true);
    try {
      if (messageChannel === 'note') {
        await createOrderMessage(order.id, {
          authorType: 'admin',
          authorId: adminAuthorId,
          authorName: adminName,
          channel: 'note',
          visibility: 'internal',
          message: messageBody.trim(),
        });
        toast.success('Internal note saved');
      }

      if (messageChannel === 'chat') {
        await createOrderMessage(order.id, {
          authorType: 'admin',
          authorId: adminAuthorId,
          authorName: adminName,
          channel: 'chat',
          visibility: 'customer',
          message: messageBody.trim(),
        });
        toast.success('In-app reply sent to the customer');
      }

      if (messageChannel === 'whatsapp') {
        const result = await sendOrderWhatsAppMessage({
          orderId: order.id,
          to: order.shippingAddress.mobile,
          message: messageBody.trim(),
          authorId: adminAuthorId,
          authorName: adminName,
        });

        if (!result.ok) {
          toast.error(result.error || 'WhatsApp send failed');
          return;
        }

        toast.success('WhatsApp message sent');
      }

      if (messageChannel === 'push') {
        if (!messageTitle.trim()) {
          toast.error('Add a push notification title');
          return;
        }

        const result = await sendOrderPushMessage({
          orderId: order.id,
          userId: order.userId,
          title: messageTitle.trim(),
          body: messageBody.trim(),
          url: `/account/orders/${order.id}`,
          authorId: adminAuthorId,
          authorName: adminName,
        });

        if (!result.ok) {
          toast.error(result.error || 'Push notification failed');
          return;
        }

        toast.success('Web push sent to the customer');
      }

      setMessageBody('');
    } catch (error) {
      console.error('Error sending order message:', error);
      toast.error('Failed to send the message');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <Package className="mx-auto h-12 w-12 text-gray-300" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Order not found</h1>
          <p className="mt-1 text-sm text-gray-500">The requested order could not be loaded from Firestore.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/orders')}>Back to Orders</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-200/50 bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(255,255,255,1),rgba(254,243,199,0.55))] p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <button
            onClick={() => navigate('/admin/orders')}
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Orders
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Order ORD-{order.orderId}</h1>
            <Badge className={getStatusBadgeClass(order.status)}>{getStatusLabel(order.status)}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(order.createdAt)}</span>
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{order.userEmail}</span>
            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{order.shippingAddress.mobile}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate(`/admin/customers/${order.userId}`)}>
            <User className="mr-2 h-4 w-4" />
            Customer Profile
          </Button>
          {order.delivery_boy_id && (
            <Button variant="outline" onClick={() => navigate(`/admin/delivery-boys/${order.delivery_boy_id}`)}>
              <Truck className="mr-2 h-4 w-4" />
              Delivery Partner
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Order Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatPrice(order.total)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Items</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{order.items.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Payment</p>
          <p className="mt-1 text-2xl font-bold capitalize text-gray-900">{order.paymentMethod}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Assigned Partner</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{order.delivery_boy_name || 'Not assigned'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Items & Totals</h2>
              <span className="text-sm text-gray-500">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={`${item.productId}-${index}`} className="flex gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <img src={item.image} alt={item.name} className="h-16 w-16 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Qty {item.quantity}
                      {item.size ? ` • Size ${item.size}` : ''}
                      {item.color ? ` • ${item.color}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-dashed border-gray-200 pt-4 text-sm text-gray-600">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              <div className="flex items-center justify-between"><span>Delivery charge</span><span>{formatPrice(order.deliveryCharge)}</span></div>
              <div className="flex items-center justify-between"><span>Tax</span><span>{formatPrice(order.taxAmount)}</span></div>
              {order.discount > 0 && <div className="flex items-center justify-between text-emerald-600"><span>Discount</span><span>- {formatPrice(order.discount)}</span></div>}
              <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-semibold text-gray-900"><span>Total</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><User className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Customer & Address</h2>
                  <p className="text-sm text-gray-500">Contact and fulfilment details.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="font-medium text-gray-900">{order.shippingAddress.fullName}</p>
                  <p className="mt-1">{order.userEmail}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{order.shippingAddress.mobile}</p>
                  {order.shippingAddress.alternativePhone && <p className="mt-1">Alt: {order.shippingAddress.alternativePhone}</p>}
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="inline-flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5" />
                    <span>
                      {order.shippingAddress.address}
                      {order.shippingAddress.locality ? `, ${order.shippingAddress.locality}` : ''}
                      <br />
                      {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                      {order.shippingAddress.landmark ? ` • Landmark: ${order.shippingAddress.landmark}` : ''}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><ShieldCheck className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Fulfilment Snapshot</h2>
                  <p className="text-sm text-gray-500">Tracking, OTP and delivery ownership.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span>Status</span>
                  <Badge className={getStatusBadgeClass(order.status)}>{getStatusLabel(order.status)}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span>Delivery partner</span>
                  <span className="font-medium text-gray-900">{order.delivery_boy_name || 'Pending assignment'}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span>Delivery OTP</span>
                  <span className="font-medium text-gray-900">{order.delivery_otp || 'Not generated'}</span>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="font-medium text-gray-900">Tracking URL</p>
                  {order.trackingUrl ? (
                    <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800">
                      Open tracking link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">No tracking link added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Order Activity</h2>
                <p className="text-sm text-gray-500">Status history and admin timeline for this order.</p>
              </div>
            </div>

            <div className="space-y-4">
              {(order.statusHistory || []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
                  No status history recorded yet.
                </div>
              ) : (
                (order.statusHistory || []).map((entry, index) => (
                  <div key={`${entry.status}-${index}`} className="flex gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="mt-1 h-3 w-3 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{getStatusLabel(entry.status as Order['status'])}</p>
                        <span className="text-xs text-gray-500">{formatDateTime(entry.timestamp)}</span>
                      </div>
                      {entry.note && <p className="mt-1 text-sm text-gray-600">{entry.note}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Admin Controls</h2>
              <p className="text-sm text-gray-500">Update order state, tracking, and delivery ownership from one workspace.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Status</h3>
                <p className="mt-1 text-xs text-gray-500">Uses the main status workflow and customer notification path.</p>
                <select
                  value={statusValue}
                  onChange={(event) => setStatusValue(event.target.value as Order['status'])}
                  className="mt-4 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none ring-0 focus:border-amber-500"
                >
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Button className="mt-4 w-full" onClick={handleStatusSave} disabled={savingStatus || statusValue === order.status}>
                  {savingStatus ? 'Updating...' : 'Save Status'}
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Tracking</h3>
                <p className="mt-1 text-xs text-gray-500">Status, notes and URL update together.</p>
                <select
                  value={trackingStatus}
                  onChange={(event) => setTrackingStatus(event.target.value as Order['status'])}
                  className="mt-4 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none ring-0 focus:border-amber-500"
                >
                  {ORDER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Input className="mt-3" placeholder="https://tracking-url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} />
                <Textarea className="mt-3 min-h-[110px]" placeholder="Tracking note for the team and timeline" value={trackingNote} onChange={(event) => setTrackingNote(event.target.value)} />
                <Button className="mt-4 w-full" onClick={handleTrackingSave} disabled={savingTracking}>
                  {savingTracking ? 'Saving...' : 'Save Tracking'}
                </Button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Delivery Partner</h3>
                <p className="mt-1 text-xs text-gray-500">Assign or reassign the last-mile owner.</p>
                <select
                  value={selectedDeliveryBoyId}
                  onChange={(event) => setSelectedDeliveryBoyId(event.target.value)}
                  className="mt-4 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none ring-0 focus:border-amber-500"
                >
                  <option value="">Select delivery partner</option>
                  {deliveryBoys.map((boy) => (
                    <option key={boy.id} value={boy.id}>{boy.name}</option>
                  ))}
                </select>
                <Button className="mt-4 w-full" onClick={handleAssignPartner} disabled={assigningPartner || !selectedDeliveryBoyId}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {assigningPartner ? 'Assigning...' : order.delivery_boy_id ? 'Reassign Partner' : 'Assign Partner'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-600"><MessageSquare className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Order Conversation</h2>
                <p className="text-sm text-gray-500">Internal notes, WhatsApp sends, and web push history for this order.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_MESSAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setMessageChannel('chat');
                    setMessageBody(preset);
                  }}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  No conversation entries yet. The first message or note you send will appear here.
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getMessageChannelBadgeClass(message.channel)}>{message.channel}</Badge>
                      <Badge variant="outline" className="capitalize">{message.visibility}</Badge>
                      {message.deliveryStatus && (
                        <Badge variant="outline" className="capitalize">{message.deliveryStatus}</Badge>
                      )}
                      <span className="text-xs text-gray-500">{message.authorName || message.authorType}</span>
                      <span className="text-xs text-gray-400">{formatDateTime(message.createdAt)}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{message.message}</p>
                    {message.metadata?.error && (
                      <p className="mt-2 text-xs text-red-500">{message.metadata.error}</p>
                    )}
                    {message.metadata?.trackingUrl && (
                      <a href={message.metadata.trackingUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        Open tracking link
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMessageChannel(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      messageChannel === option.value
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {messageChannel === 'push' && (
                <Input
                  className="mt-3"
                  value={messageTitle}
                  onChange={(event) => setMessageTitle(event.target.value)}
                  placeholder="Push notification title"
                />
              )}

              <Textarea
                className="mt-3 min-h-[130px]"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder={
                  messageChannel === 'note'
                    ? 'Add an internal note for the admin team'
                    : messageChannel === 'chat'
                      ? 'Write an in-app reply the customer will see in their order page'
                    : messageChannel === 'whatsapp'
                      ? 'Write the WhatsApp message for the customer'
                      : 'Write the push notification body'
                }
              />

              <Button className="mt-3 w-full" onClick={handleSendMessage} disabled={sendingMessage || !messageBody.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {sendingMessage
                  ? 'Sending...'
                  : messageChannel === 'note'
                    ? 'Save Note'
                    : messageChannel === 'chat'
                      ? 'Send In-App Reply'
                    : messageChannel === 'whatsapp'
                      ? 'Send WhatsApp'
                      : 'Send Web Push'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><BellRing className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Contact Surface</h2>
                <p className="text-sm text-gray-500">Quick facts for follow-up messaging and support.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Customer</span>
                <span className="font-medium text-gray-900">{order.userName}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Mobile</span>
                <span className="font-medium text-gray-900">{order.shippingAddress.mobile}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />Email</span>
                <span className="font-medium text-gray-900">{order.userEmail}</span>
              </div>
              <div className="rounded-xl bg-gray-50 px-4 py-3">
                <p className="font-medium text-gray-900">Support note</p>
                <p className="mt-1 text-sm text-gray-500">
                  Status changes and tracking updates now trigger the same best-effort customer notification path used elsewhere in order operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetails;