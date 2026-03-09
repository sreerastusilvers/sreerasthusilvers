import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  Truck,
  MapPin,
  Phone,
  Navigation,
  User,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  PackageCheck,
  Clock,
  Package,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  getOrder,
  Order,
  updateDeliveryStatusByDeliveryBoy,
  acceptOrderByDeliveryBoy,
  startDelivery,
  verifyDeliveryOTP
} from '@/services/orderService';
import { toast } from 'sonner';

// Status configuration for badges
const statusConfig: Record<Order['status'], { label: string; color: string; bgColor: string; borderColor: string; dotColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', dotColor: 'bg-amber-500', icon: Clock },
  processing: { label: 'Processing', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', icon: Package },
  shipped: { label: 'Assigned', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', dotColor: 'bg-violet-500', icon: Truck },
  assigned: { label: 'Assigned', color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-200', dotColor: 'bg-violet-500', icon: Truck },
  picked: { label: 'Picked Up', color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', dotColor: 'bg-indigo-500', icon: PackageCheck },
  outForDelivery: { label: 'Out for Delivery', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', dotColor: 'bg-orange-500', icon: Truck },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', dotColor: 'bg-rose-500', icon: AlertCircle },
  returnRequested: { label: 'Return Requested', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', dotColor: 'bg-amber-500', icon: AlertCircle },
  returnScheduled: { label: 'Return Scheduled', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', dotColor: 'bg-purple-500', icon: Truck },
  returned: { label: 'Returned', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', dotColor: 'bg-gray-500', icon: PackageCheck },
};

const DeliveryOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, isDelivery } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Redirect if not logged in or not a delivery boy
  useEffect(() => {
    if (!user || !isDelivery) {
      navigate('/delivery');
      return;
    }
  }, [user, isDelivery, navigate]);

  // Fetch order details
  useEffect(() => {
    if (!orderId) {
      navigate('/delivery/dashboard');
      return;
    }

    const fetchOrder = async () => {
      try {
        const fetchedOrder = await getOrder(orderId);
        if (fetchedOrder) {
          // Verify this order is assigned to the current delivery boy
          if (fetchedOrder.delivery_boy_id !== user?.uid) {
            toast.error('You are not assigned to this order');
            navigate('/delivery/dashboard');
            return;
          }
          setOrder(fetchedOrder);
        } else {
          toast.error('Order not found');
          navigate('/delivery/dashboard');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('Failed to load order details');
        navigate('/delivery/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user, navigate]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Open phone dialer
  const openPhoneDialer = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Open maps
  const openMaps = () => {
    if (order) {
      navigate(`/delivery/map/${order.id}`);
    }
  };

  // Copy Google Maps link with coordinates
  const copyAddressWithCoordinates = async () => {
    if (!order) return;
    
    setCopying(true);
    try {
      const address = order.shippingAddress;
      
      let lat: number | null = null;
      let lon: number | null = null;
      
      // Use stored coordinates if available (most accurate)
      if (address.latitude && address.longitude) {
        lat = address.latitude;
        lon = address.longitude;
      } else {
        // Helper: Haversine distance in km
        const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        // Helper: try a Nominatim query
        const tryGeo = async (q: string) => {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=in`);
          const data = await res.json();
          return data?.length > 0 ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
        };

        // Get city reference point first
        const cityRef = await tryGeo(`${address.city}, ${address.state}, India`);
        if (cityRef) {
          // Try locality-based queries, validate within 20km of city
          const queries = [
            address.locality ? `${address.locality}, ${address.city}, ${address.state}, India` : '',
            address.locality && address.pincode ? `${address.locality}, ${address.pincode}, India` : '',
            address.pincode ? `${address.pincode}, ${address.city}, India` : '',
            address.pincode ? `${address.pincode}, India` : '',
          ].filter(Boolean);

          for (const query of queries) {
            try {
              const result = await tryGeo(query);
              if (result && haversineKm(cityRef.lat, cityRef.lon, result.lat, result.lon) <= 20) {
                lat = result.lat;
                lon = result.lon;
                break;
              }
            } catch { continue; }
          }

          // Fall back to city center
          if (lat === null) {
            lat = cityRef.lat;
            lon = cityRef.lon;
          }
        }
      }
      
      if (lat !== null && lon !== null) {
        const mapsLink = `https://maps.google.com/?q=${lat},${lon}`;
        
        // Try modern clipboard API first, fallback to execCommand
        let copySuccess = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(mapsLink);
            copySuccess = true;
          }
        } catch (_) {
          // clipboard API failed, try fallback
        }
        
        if (!copySuccess) {
          const textarea = document.createElement('textarea');
          textarea.value = mapsLink;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '-9999px';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          try {
            document.execCommand('copy');
            copySuccess = true;
          } catch (_) {
            // execCommand also failed
          }
          document.body.removeChild(textarea);
        }
        
        if (copySuccess) {
          setCopied(true);
          toast.success('Map link copied!');
          setTimeout(() => setCopied(false), 2000);
        } else {
          window.prompt('Copy this link:', mapsLink);
        }
      } else {
        toast.error('Unable to get coordinates for this address');
      }
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy map link');
    } finally {
      setCopying(false);
    }
  };

  // Handle accept order (shipped/assigned -> picked)
  const handleAcceptOrder = async (orderId: string) => {
    if (!user) return;
    setUpdatingStatus(true);
    try {
      await acceptOrderByDeliveryBoy(orderId, user.uid);
      toast.success('Order accepted and picked up!');
      
      // Refresh order details
      const updatedOrder = await getOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    } catch (error: any) {
      console.error('Error accepting order:', error);
      toast.error(error.message || 'Failed to accept order');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle start delivery (picked -> outForDelivery)
  const handleStartDelivery = async (orderId: string) => {
    if (!user) return;
    setUpdatingStatus(true);
    try {
      await startDelivery(orderId, user.uid);
      toast.success('Delivery started!');
      
      // Refresh order details
      const updatedOrder = await getOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
    } catch (error: any) {
      console.error('Error starting delivery:', error);
      toast.error(error.message || 'Failed to start delivery');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle OTP verification
  const handleOTPChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 4);
    setOtpInput(cleanValue);
    setOtpError('');
  };

  const handleVerifyOTP = async () => {
    if (otpInput.length !== 4) {
      setOtpError('Please enter 4-digit OTP');
      return;
    }
    
    if (!order || !user) return;

    setVerifyingOTP(true);
    try {
      await verifyDeliveryOTP(order.id, otpInput, user.uid);
      toast.success('✅ Delivery completed successfully!', {
        description: 'The order has been marked as delivered.',
      });
      
      // Refresh order details
      const updatedOrder = await getOrder(order.id);
      if (updatedOrder) {
        setOrder(updatedOrder);
      }
      
      setOtpInput('');
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpError(error.message || 'Invalid OTP');
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOTP(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-stone-600 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const status = statusConfig[order.status];
  const fullAddress = `${order.shippingAddress.address}, ${order.shippingAddress.locality || ''} ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`;

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-4xl mx-auto">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/delivery/dashboard')}
            className="p-2 rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-200 transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">Order Details</p>
            <p className="font-mono text-base font-bold text-stone-800">#{order.orderId}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border ${status.bgColor} ${status.borderColor}`}
        >
          <div className={`w-2 h-2 rounded-full ${status.dotColor}`} />
          <span className={`font-semibold ${status.color}`}>{status.label}</span>
        </motion.div>

        {/* Customer Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm"
        >
          <h3 className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-4">
            Customer Information
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
              <User className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-stone-800 font-semibold">{order.shippingAddress.fullName}</p>
              <p className="text-sm text-stone-400">{order.userName}</p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => openPhoneDialer(order.shippingAddress.mobile)}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-semibold transition-all hover:bg-emerald-100"
          >
            <Phone className="h-5 w-5" />
            Call Customer
          </motion.button>
          {order.shippingAddress.alternativePhone && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => openPhoneDialer(order.shippingAddress.alternativePhone!)}
              className="w-14 flex items-center justify-center bg-stone-50 border border-stone-200 text-stone-600 rounded-xl transition-all hover:bg-stone-100"
            >
              <Phone className="h-5 w-5" />
            </motion.button>
          )}
        </motion.div>

        {/* Delivery Address */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm"
        >
          <h3 className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-4">
            Delivery Address
          </h3>
          <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 space-y-2">
            <p className="text-stone-800 font-medium">{order.shippingAddress.address}</p>
            {order.shippingAddress.locality && (
              <p className="text-stone-600">{order.shippingAddress.locality}</p>
            )}
            <p className="text-stone-500">
              {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
            </p>
            {order.shippingAddress.landmark && (
              <p className="text-stone-400 text-sm italic">
                Near: {order.shippingAddress.landmark}
              </p>
            )}
            <div className="pt-4 space-y-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={openMaps}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-semibold transition-all hover:bg-blue-100"
              >
                <Navigation className="h-5 w-5" />
                Open in Maps
                <ExternalLink className="h-4 w-4 ml-1 opacity-50" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={copyAddressWithCoordinates}
                disabled={copying}
                className="flex items-center justify-center gap-2 w-full py-3 bg-stone-50 border border-stone-200 text-stone-700 rounded-xl font-medium transition-all hover:bg-stone-100 disabled:opacity-50"
              >
                {copying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Geocoding...
                  </>
                ) : copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Map Link
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Order Items */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm"
        >
          <h3 className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-4">
            Items ({order.items.length})
          </h3>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center gap-4 bg-stone-50 border border-stone-100 rounded-xl p-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-14 h-14 rounded-xl object-cover border border-stone-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-stone-800 text-sm font-medium truncate">{item.name}</p>
                  <p className="text-stone-400 text-xs">Qty: {item.quantity}</p>
                </div>
                <p className="text-amber-600 font-semibold">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Payment Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm"
        >
          <h3 className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-4">
            Payment Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span className="text-stone-700">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Delivery</span>
              <span className="text-stone-700">{formatCurrency(order.deliveryCharge)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Discount</span>
                <span className="text-emerald-600">-{formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-stone-200">
              <span className="text-stone-800 font-semibold">Total</span>
              <span className="text-amber-600 font-bold text-xl">{formatCurrency(order.total)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-stone-200 flex items-center gap-2">
            <span className="text-stone-400 text-xs">Payment Method:</span>
            <span className="text-stone-600 text-xs font-medium">{order.paymentMethod}</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        {order.status !== 'delivered' && order.status !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {/* Step 1: Accept Order (shipped/assigned -> picked) */}
            {(order.status === 'shipped' || order.status === 'assigned') && (
              <Button
                onClick={() => handleAcceptOrder(order.id)}
                disabled={updatingStatus}
                className="w-full h-14 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white font-bold rounded-xl text-base shadow-lg shadow-indigo-500/20"
              >
                {updatingStatus ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PackageCheck className="h-5 w-5 mr-2" />
                    Accept & Pick Up
                  </>
                )}
              </Button>
            )}

            {/* Step 2: Start Delivery (picked -> outForDelivery) */}
            {order.status === 'picked' && (
              <Button
                onClick={() => handleStartDelivery(order.id)}
                disabled={updatingStatus}
                className="w-full h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-base shadow-lg shadow-amber-500/20"
              >
                {updatingStatus ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Truck className="h-5 w-5 mr-2" />
                    Start Delivery
                  </>
                )}
              </Button>
            )}

            {/* Step 3: OTP Verification (outForDelivery -> delivered) */}
            {order.status === 'outForDelivery' && (
              <div className="space-y-3 bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                {/* OTP Input */}
                <div className="space-y-2">
                  <label className="text-xs sm:text-[10px] uppercase tracking-widest text-stone-400 font-semibold">
                    Enter Customer's Delivery OTP
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={otpInput}
                      onChange={(e) => handleOTPChange(e.target.value)}
                      placeholder="••••"
                      className={`flex-1 h-12 sm:h-14 px-3 bg-white border-2 rounded-lg text-center text-xl sm:text-2xl font-bold tracking-[0.5em] text-stone-800 placeholder:text-stone-300 focus:outline-none focus:ring-0 transition-colors ${
                        otpError ? 'border-rose-300 focus:border-rose-400' : 'border-amber-300 focus:border-amber-500'
                      }`}
                    />
                  </div>
                  {otpError && (
                    <p className="text-rose-500 text-xs font-medium">{otpError}</p>
                  )}
                </div>

                {/* Verify Button */}
                <Button
                  onClick={handleVerifyOTP}
                  disabled={verifyingOTP || otpInput.length !== 4}
                  className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold rounded-lg text-sm sm:text-base shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifyingOTP ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5 mr-2" />
                      <span className="hidden sm:inline">Verify OTP & Complete Delivery</span>
                      <span className="sm:hidden">Verify & Complete</span>
                    </>
                  )}
                </Button>

                {/* OTP Info Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                    <p className="text-amber-700 text-xs">
                      Ask the customer to share their OTP from the Account page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Delivered Success Badge */}
        {order.status === 'delivered' && order.otp_verified && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 justify-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">Delivered & OTP Verified</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DeliveryOrderDetails;
