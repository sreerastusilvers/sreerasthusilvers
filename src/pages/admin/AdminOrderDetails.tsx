import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Truck,
  UserPlus,
  Calendar,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { subscribeToDeliveryBoys, DeliveryBoy } from '@/services/deliveryBoyService';
import {
  assignDeliveryPartner,
  assignReturnPickupPartner,
  getNextStatus,
  isValidStatusTransition,
  normalizeOrderStatus,
  Order,
  subscribeToOrder,
  updateOrderStatus,
  setDeliveryWindow,
} from '@/services/orderService';

/**
 * Canonical, simplified status options for the admin dropdown. Legacy values
 * (shipped/assigned/picked) are intentionally excluded — they are normalised
 * to `packed` / `outForDelivery` for display.
 */
const STATUS_OPTIONS: Array<{ value: Order['status']; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'packed', label: 'Packed' },
  { value: 'outForDelivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  // Exception flow
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returnRequested', label: 'Return Requested' },
  { value: 'returnScheduled', label: 'Return Scheduled' },
  { value: 'picked', label: 'Return Picked Up' },
  { value: 'returned', label: 'Returned' },
  { value: 'deliveryFailed', label: 'Delivery Failed' },
];

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-200 text-gray-800 hover:bg-gray-200' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  packed: { label: 'Packed', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  outForDelivery: { label: 'Out for Delivery', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  delivered: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  returnRequested: { label: 'Return Requested', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  returnScheduled: { label: 'Return Scheduled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  picked: { label: 'Return Picked Up', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
  returned: { label: 'Returned', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  deliveryFailed: { label: 'Delivery Failed', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

const NEXT_STEP_HINT: Record<string, string> = {
  pending: 'Confirm the order to start processing.',
  processing: 'Pack the items and mark as Packed when ready.',
  packed: 'Assign a delivery partner — this will mark the order as Out for Delivery.',
  outForDelivery: 'Awaiting OTP verification by the delivery partner at the customer\'s door.',
  delivered: 'Order completed.',
  cancelled: 'Order cancelled.',
  returnRequested: 'Approve and schedule the return pickup.',
  returnScheduled: 'Awaiting return pickup.',
  picked: 'Item collected from customer. Share the Return Store OTP below with the delivery partner to confirm receipt at store.',
  returned: 'Return completed.',
  deliveryFailed: 'Delivery failed. Share the Return Store OTP with the delivery partner when they arrive at the store.',
};

const formatPrice = (price: number) =>
  `₹${(price ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

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

const AdminOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryBoy[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [assigningReturn, setAssigningReturn] = useState(false);

  // Delivery window state
  const [windowDate, setWindowDate] = useState('');
  const [windowFrom, setWindowFrom] = useState('');
  const [windowTo, setWindowTo]     = useState('');
  const [windowNote, setWindowNote] = useState('');
  const [savingWindow, setSavingWindow] = useState(false);

  // Real-time subscription to the order document.
  useEffect(() => {
    if (!orderId) {
      navigate('/admin/orders');
      return;
    }
    setLoading(true);
    const unsub = subscribeToOrder(
      orderId,
      (data) => {
        if (!data) {
          toast.error('Order not found');
          navigate('/admin/orders');
          return;
        }
        setOrder(data);
        setLoading(false);
      },
      (err) => {
        console.error('order subscription error', err);
        toast.error('Failed to load order');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [orderId, navigate]);

  // Load active delivery partners.
  useEffect(() => {
    const unsub = subscribeToDeliveryBoys(
      (boys) => setDeliveryPartners(boys.filter((b) => b.isActive !== false)),
      (err) => console.error('partners subscription error', err),
    );
    return () => unsub();
  }, []);

  const normalizedStatus = useMemo(() => {
    if (!order) return 'pending';
    // In return context, 'picked' means item collected from customer — do not normalize to outForDelivery
    if (order.status === 'picked' && (order as any).returnScheduledAt) return 'picked';
    return normalizeOrderStatus(order.status);
  }, [order]);

  const handleStatusChange = async (next: Order['status']) => {
    if (!order || next === order.status) return;
    if (!isValidStatusTransition(order.status, next)) {
      toast.error('Status can only move forward in the workflow.');
      return;
    }
    if (next === 'outForDelivery' && !order.delivery_boy_id && !order.delivery_partner_id) {
      toast.error('Assign a delivery partner first — that will mark the order as Out for Delivery.');
      return;
    }
    setSavingStatus(true);
    try {
      await updateOrderStatus(order.id, next);
      toast.success(`Status updated to ${STATUS_BADGE[next]?.label || next}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAssignReturnPartner = async (partnerId: string) => {
    if (!order || !partnerId) return;
    const partner = deliveryPartners.find((p) => p.id === partnerId);
    if (!partner) return;
    setAssigningReturn(true);
    try {
      const { otp: pickupOtp } = await assignReturnPickupPartner(
        order.id,
        partner.id,
        partner.name,
        partner.phone,
      );
      toast.success(`Return pickup assigned to ${partner.name}`, {
        description: `Pickup OTP ${pickupOtp} has been shared with the customer.`,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to assign return pickup partner');
    } finally {
      setAssigningReturn(false);
    }
  };

  const handleAssignPartner = async (partnerId: string) => {
    if (!order || !partnerId) return;
    const partner = deliveryPartners.find((p) => p.id === partnerId);
    if (!partner) return;
    setAssigning(true);
    try {
      const { otp } = await assignDeliveryPartner(
        order.id,
        partner.id,
        partner.name,
        partner.phone,
      );
      toast.success(`Assigned to ${partner.name}`, {
        description: `OTP ${otp} shared with the customer.`,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to assign delivery partner');
    } finally {
      setAssigning(false);
    }
  };

  const handleSetWindow = async () => {
    if (!order || !windowDate || !windowFrom || !windowTo) {
      toast.error('Please fill in date and time range.');
      return;
    }
    setSavingWindow(true);
    try {
      await setDeliveryWindow(order.id, { date: windowDate, from: windowFrom, to: windowTo, note: windowNote || undefined });
      toast.success('Delivery window saved!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save delivery window.');
    } finally {
      setSavingWindow(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!order) return null;

  const badge = STATUS_BADGE[normalizedStatus] || STATUS_BADGE.pending;
  const nextStatus = normalizedStatus === 'picked' ? ('returned' as Order['status']) : getNextStatus(normalizedStatus);
  const isPaid =
    order.paymentStatus === 'paid' || order.paymentMethod?.toLowerCase().includes('online');
  const partnerName = order.delivery_partner_name || order.delivery_boy_name;
  const partnerPhone = order.delivery_partner_phone;
  const otp = order.delivery_otp;
  const returnOtp = (order as any).return_otp as string | undefined;
  const returnStoreOtp = (order as any).return_store_otp as string | undefined;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Order</p>
            <h1 className="font-mono text-lg font-bold text-gray-900 dark:text-zinc-100">
              #{order.orderId}
            </h1>
          </div>
        </div>
        <Badge className={`${badge.className} px-3 py-1.5 text-sm font-semibold`}>
          {badge.label}
        </Badge>
      </div>

      {/* Top summary card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Customer</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-zinc-100">
              {order.shippingAddress?.fullName || order.userName}
            </p>
            <p className="text-xs text-gray-500">{order.shippingAddress?.mobile}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Total</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{formatPrice(order.total)}</p>
            <p className="text-xs text-gray-500">{order.items?.length || 0} item(s)</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Payment</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-zinc-100">
              {order.paymentMethod || 'COD'}
            </p>
            <p className={`text-xs font-medium ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isPaid ? 'Paid' : 'Pending'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-gray-400">Placed</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-zinc-300">
              {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        {NEXT_STEP_HINT[normalizedStatus] && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="font-semibold">Next:</span> {NEXT_STEP_HINT[normalizedStatus]}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          <Package className="h-4 w-4" /> Items
        </h2>
        <div className="space-y-2">
          {order.items?.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-2 dark:bg-zinc-800/50"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-12 w-12 rounded-md object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-zinc-100">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">Qty {item.quantity}</p>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Status + Assign Partner */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status control */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            Order Status
          </h2>
          <Select
            value={normalizedStatus}
            onValueChange={(v) => handleStatusChange(v as Order['status'])}
            disabled={savingStatus}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => {
                const allowed =
                  opt.value === normalizedStatus ||
                  isValidStatusTransition(normalizedStatus, opt.value);
                return (
                  <SelectItem key={opt.value} value={opt.value} disabled={!allowed}>
                    {opt.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-gray-500">
            Changes save automatically. Status can only move forward.
          </p>
          {nextStatus && (
            <Button
              className="mt-3 w-full"
              variant="outline"
              size="sm"
              disabled={savingStatus || (nextStatus === 'outForDelivery' && !partnerName)}
              onClick={() => handleStatusChange(nextStatus)}
            >
              {savingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Mark as {STATUS_BADGE[nextStatus]?.label || nextStatus}
            </Button>
          )}
        </div>

        {/* Delivery partner / Return pickup partner */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            <Truck className="h-4 w-4" />
            {normalizedStatus === 'returnRequested' || normalizedStatus === 'returnScheduled' || normalizedStatus === 'picked'
              ? 'Return Pickup Partner'
              : 'Delivery Partner'}
          </h2>

          {/* Return flow — assign pickup partner */}
          {normalizedStatus === 'returnRequested' ? (
            <div className="space-y-2">
              <Select onValueChange={handleAssignReturnPartner} disabled={assigningReturn}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a pickup partner…" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryPartners.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No active partners
                    </SelectItem>
                  )}
                  {deliveryPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-3 w-3" />
                        {p.name}
                        {p.phone ? <span className="text-xs text-gray-500">· {p.phone}</span> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Assigning a pickup partner will set the order to{' '}
                <span className="font-medium">Return Scheduled</span> and share a pickup OTP with
                the customer.
              </p>
              {assigningReturn && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Assigning…
                </div>
              )}
            </div>
          ) : partnerName ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                    {partnerName}
                  </p>
                  {partnerPhone && (
                    <a
                      href={`tel:${partnerPhone}`}
                      className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"
                    >
                      <Phone className="h-3 w-3" /> {partnerPhone}
                    </a>
                  )}
                </div>
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              </div>
              {otp && normalizedStatus === 'outForDelivery' && (
                <div className="mt-3 rounded-md bg-white px-3 py-2 dark:bg-zinc-900/60">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    Delivery OTP
                  </p>
                  <p className="font-mono text-lg font-bold tracking-[0.4em] text-amber-600">
                    {otp}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Customer can see this on their order page.
                  </p>
                </div>
              )}
              {returnOtp && normalizedStatus === 'returnScheduled' && (
                <div className="mt-3 rounded-md bg-white px-3 py-2 dark:bg-zinc-900/60">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    Return Pickup OTP
                  </p>
                  <p className="font-mono text-lg font-bold tracking-[0.4em] text-amber-600">
                    {returnOtp}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Customer shows this OTP to the pickup partner.
                  </p>
                </div>
              )}
              {returnStoreOtp && (normalizedStatus === 'picked' || normalizedStatus === 'deliveryFailed') && (
                <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 dark:bg-amber-500/10 dark:border-amber-500/30">
                  <p className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    Return Store OTP
                  </p>
                  <p className="font-mono text-2xl font-bold tracking-[0.4em] text-amber-700 dark:text-amber-300">
                    {returnStoreOtp}
                  </p>
                  <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                    Tell this OTP to the delivery partner when they arrive at the store.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Select onValueChange={handleAssignPartner} disabled={assigning}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a delivery partner…" />
                </SelectTrigger>
                <SelectContent>
                  {deliveryPartners.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No active partners
                    </SelectItem>
                  )}
                  {deliveryPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-3 w-3" />
                        {p.name}
                        {p.phone ? <span className="text-xs text-gray-500">· {p.phone}</span> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Assigning a partner automatically sets the order to{' '}
                <span className="font-medium">Out for Delivery</span> and generates an OTP for
                the customer.
              </p>
              {assigning && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Assigning…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delivery Window Setter — available when order is out for delivery */}
      {(normalizedStatus === 'outForDelivery') && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 shadow-sm dark:border-purple-800 dark:bg-purple-900/20">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-900 dark:text-purple-100">
            <Calendar className="h-4 w-4" /> Set Delivery Window
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-purple-700 mb-1 block">Date</label>
              <input
                type="date"
                value={windowDate}
                onChange={(e) => setWindowDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none dark:bg-zinc-800 dark:border-purple-600 dark:text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-purple-700 mb-1 block">From</label>
                <input
                  type="time"
                  value={windowFrom}
                  onChange={(e) => setWindowFrom(e.target.value)}
                  className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none dark:bg-zinc-800 dark:border-purple-600 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-purple-700 mb-1 block">To</label>
                <input
                  type="time"
                  value={windowTo}
                  onChange={(e) => setWindowTo(e.target.value)}
                  className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none dark:bg-zinc-800 dark:border-purple-600 dark:text-zinc-100"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-purple-700 mb-1 block">Note (optional)</label>
              <textarea
                value={windowNote}
                onChange={(e) => setWindowNote(e.target.value)}
                placeholder="e.g. Please be available at the gate"
                rows={2}
                className="w-full rounded-xl border border-purple-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none resize-none dark:bg-zinc-800 dark:border-purple-600 dark:text-zinc-100"
              />
            </div>
            <Button
              onClick={handleSetWindow}
              disabled={savingWindow || !windowDate || !windowFrom || !windowTo}
              className="w-full bg-purple-600 hover:bg-purple-700 text-sm font-bold"
            >
              {savingWindow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Save Delivery Window
            </Button>
          </div>
        </div>
      )}

      {/* Address */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          <MapPin className="h-4 w-4" /> Delivery Address
        </h2>
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          {order.shippingAddress?.address}
          {order.shippingAddress?.locality ? `, ${order.shippingAddress.locality}` : ''},{' '}
          {order.shippingAddress?.city}, {order.shippingAddress?.state} -{' '}
          {order.shippingAddress?.pincode}
        </p>
        {order.shippingAddress?.landmark && (
          <p className="mt-1 text-xs italic text-gray-500">
            Landmark: {order.shippingAddress.landmark}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminOrderDetails;
