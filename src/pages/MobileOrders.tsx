import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToUserOrders, Order } from '@/services/orderService';
import Header from '@/components/Header';
import MobileHeader from '@/components/MobileHeader';
import MobileSearchBar from '@/components/MobileSearchBar';
import CategoryIconNav from '@/components/CategoryIconNav';
import Footer from '@/components/Footer';
import {
  Loader2,
  Package,
  ArrowLeft,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  RotateCcw as ReturnIcon,
} from 'lucide-react';

const MobileOrders = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const [selectedOrderTab, setSelectedOrderTab] = useState('current');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Subscribe to user orders
  useEffect(() => {
    if (!user) return;

    console.log('Setting up order subscription for user:', user.uid);
    setOrdersLoading(true);
    
    const unsubscribe = subscribeToUserOrders(
      user.uid,
      (fetchedOrders) => {
        console.log('📦 [MobileOrders] Real-time update received!');
        console.log('📦 [MobileOrders] Number of orders:', fetchedOrders.length);
        console.log('📦 [MobileOrders] Order details:', fetchedOrders.map(o => ({
          id: o.id,
          status: o.status,
          trackingId: o.trackingId,
          lastUpdated: o.lastUpdated
        })));
        setOrders(fetchedOrders);
        setOrdersLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        setOrdersLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up order subscription');
      unsubscribe();
    };
  }, [user]);

  // Filter orders based on tab
  const filteredOrders = selectedOrderTab === 'current'
    ? orders.filter(order => ['pending', 'processing', 'shipped', 'outForDelivery'].includes(order.status))
    : orders;

  // Format price
  const formatPrice = (price: number) => {
    return `₹${price.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (date: Date | { seconds: number; nanoseconds: number } | undefined) => {
    if (!date) return 'N/A';
    
    let jsDate: Date;
    if (date instanceof Date) {
      jsDate = date;
    } else if (typeof date === 'object' && 'seconds' in date) {
      jsDate = new Date(date.seconds * 1000);
    } else {
      return 'Invalid Date';
    }

    return jsDate.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Get status badge class - sophisticated palette
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'processing': return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'shipped': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'outForDelivery': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border border-red-200';
      case 'returnRequested': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'returnScheduled': return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'returned': return 'bg-gray-50 text-gray-700 border border-gray-200';
      default: return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3.5 h-3.5" />;
      case 'processing': return <Package className="w-3.5 h-3.5" />;
      case 'shipped': return <Truck className="w-3.5 h-3.5" />;
      case 'outForDelivery': return <MapPin className="w-3.5 h-3.5" />;
      case 'delivered': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'cancelled': return <XCircle className="w-3.5 h-3.5" />;
      case 'returnRequested': return <ReturnIcon className="w-3.5 h-3.5" />;
      case 'returnScheduled': return <ReturnIcon className="w-3.5 h-3.5" />;
      case 'returned': return <ReturnIcon className="w-3.5 h-3.5" />;
      default: return <Package className="w-3.5 h-3.5" />;
    }
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'shipped': return 'Shipped';
      case 'outForDelivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'returnRequested': return 'Return Requested';
      case 'returnScheduled': return 'Return Scheduled';
      case 'returned': return 'Returned';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

    return (
    <div className="min-h-screen bg-gray-50 pb-20" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Desktop Header + Nav */}
      <div className="hidden lg:block">
        <Header />
        <CategoryIconNav />
      </div>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader />
        <MobileSearchBar />
      </div>
      
      {/* Page Header */}
      <div className="sticky top-16 bg-white z-40 px-4 py-4 flex items-center shadow-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <button
          onClick={() => navigate('/account')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800" />
        </button>
        <h1 className="ml-3 text-lg font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>My Orders</h1>
      </div>

      {/* Order Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 pt-4 sticky top-[120px] z-30" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedOrderTab('current')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              selectedOrderTab === 'current'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => setSelectedOrderTab('all')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              selectedOrderTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            All orders
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {ordersLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-gray-800 mb-1">No orders yet!</h3>
            <p className="text-sm text-gray-500 mb-6">
              {selectedOrderTab === 'current' ? 'Your bag is waiting — explore our silver collection!' : 'Discover stunning silver jewellery crafted just for you'}
            </p>
            <button
              onClick={() => navigate('/category/jewellery')}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              ✨ Start Shopping
            </button>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div 
              key={order.id} 
              className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow bg-white"
              onClick={() => {
                navigate(`/account/orders/${order.id}`);
              }}
            >
              {/* Order Items Display */}
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex-shrink-0 overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>{item.name}</h4>
                      <p className="text-xs text-gray-600">Price: {formatPrice(item.price)}</p>
                      <p className="text-xs text-gray-600">Quantity: {item.quantity}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 mt-1 block">{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* OTP Display for Out for Delivery Orders */}
              {order.status === 'outForDelivery' && order.delivery_otp && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-900">Delivery OTP</p>
                  <p className="text-xs text-gray-600 mt-0.5">Share this OTP with your delivery partner</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{order.delivery_otp}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <Footer />
    </div>
  );
};

// Order Status Stepper Component
const OrderStatusStepper = ({ status }: { status: string }) => {
  // Check if this is a return flow
  const isReturnFlow = ['returnRequested', 'returnScheduled', 'returned'].includes(status);
  
  // Normal order steps
  const orderSteps = [
    { key: 'pending', label: 'Order\nPlaced' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'outForDelivery', label: 'Out for\nDelivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  // Return flow steps
  const returnSteps = [
    { key: 'returnRequested', label: 'Return\nRequested' },
    { key: 'returnScheduled', label: 'Return\nScheduled' },
    { key: 'returned', label: 'Picked Up' },
  ];

  const steps = isReturnFlow ? returnSteps : orderSteps;

  const getStepIndex = (currentStatus: string) => {
    const index = steps.findIndex(s => s.key === currentStatus);
    return index >= 0 ? index : 0;
  };

  const currentIndex = getStepIndex(status);
  const isCancelled = status === 'cancelled';

  // For return flow, use emerald color scheme
  const activeColor = isReturnFlow ? 'bg-emerald-500' : 'bg-blue-500';
  const activeBorder = isReturnFlow ? 'border-emerald-500' : 'border-blue-500';
  const activeText = isReturnFlow ? 'text-emerald-600' : 'text-blue-600';
  const activeDot = isReturnFlow ? 'bg-emerald-500' : 'bg-blue-500';

  return (
    <div className="flex items-start justify-between relative" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Progress Line Background */}
      <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 z-0" />
      
      {/* Progress Line Active */}
      <div 
        className={`absolute top-4 left-6 h-0.5 z-0 transition-all duration-500 ${isCancelled ? 'bg-red-500' : activeColor}`}
        style={{ 
          width: isCancelled ? '0%' : `calc(${(currentIndex / (steps.length - 1)) * 100}% - 12px)`,
        }}
      />
      
      {steps.map((step, index) => {
        const isCompleted = !isCancelled && index <= currentIndex;
        const isCurrent = !isCancelled && index === currentIndex;
        
        return (
          <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: `${100 / steps.length}%`, fontFamily: "'Poppins', sans-serif" }}>
            {/* Step Circle */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              isCancelled 
                ? 'bg-gray-100 border-gray-300'
                : isCompleted 
                  ? `${activeColor} ${activeBorder}` 
                  : 'bg-white border-gray-300'
            }`}>
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${isCurrent ? activeDot : 'bg-gray-300'}`} />
              )}
            </div>
            
            {/* Step Label */}
            <p className={`text-[10px] text-center mt-2 leading-tight whitespace-pre-line ${
              isCompleted ? `${activeText} font-medium` : 'text-gray-400'
            }`}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default MobileOrders;
