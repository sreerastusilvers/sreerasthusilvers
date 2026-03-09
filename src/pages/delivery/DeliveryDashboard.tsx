import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Loader2, 
  Truck,
  MapPin,
  Clock,
  User,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  History,
  Settings,
  HelpCircle,
  Menu,
  Bell,
  PackageCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  subscribeToDeliveryBoyOrders, 
  Order
} from '@/services/orderService';
import { toast } from 'sonner';

// Status configuration for badges - Light theme premium colors
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

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, logout, isDelivery } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Subscribe to orders assigned to this delivery boy
  useEffect(() => {
    if (!user || !isDelivery) {
      navigate('/delivery');
      return;
    }

    const unsubscribe = subscribeToDeliveryBoyOrders(
      user.uid,
      (fetchedOrders) => {
        setOrders(fetchedOrders);
        setLoading(false);
        setRefreshing(false);
        
        // Check for new orders (compare with previous count)
        const activeOrders = fetchedOrders.filter(o => 
          o.status !== 'delivered' && o.status !== 'cancelled'
        );
        if (activeOrders.length > orders.length && orders.length > 0) {
          toast.success('New order assigned!', {
            description: 'You have a new delivery assignment.',
          });
        }
      },
      (error) => {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user, isDelivery, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      // Clear any stored data
      localStorage.removeItem('delivery_remembered_email');
      toast.success('Logged out successfully');
      navigate('/delivery', { replace: true });
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  // Handle view order details
  const handleViewOrderDetails = (orderId: string) => {
    navigate(`/delivery/order/${orderId}`);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // The refresh is automatic via onSnapshot, this just shows visual feedback
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Separate orders by active and completed
  const activeOrders = orders.filter(o => 
    o.status !== 'delivered' && o.status !== 'cancelled'
  );
  const completedOrders = orders.filter(o => 
    o.status === 'delivered' || o.status === 'cancelled'
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-white to-amber-50/30">
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-5 mx-auto shadow-sm">
              <Truck className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-amber-600 mx-auto mb-3" />
          <p className="text-stone-400 text-sm font-medium">Loading deliveries...</p>
        </motion.div>
      </div>
    );
  }

  const sidebarItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Truck, label: 'Active', count: activeOrders.length },
    { icon: History, label: 'Completed', count: completedOrders.length },
    { icon: Bell, label: 'Notifications', count: 0 },
    { icon: Settings, label: 'Settings' },
    { icon: HelpCircle, label: 'Help & Support' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-amber-50/20">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-72 bg-white border-r border-stone-100 transform transition-transform duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-stone-800 text-sm">Sree Rasthu</h1>
                <p className="text-xs text-stone-400">Delivery Partner</p>
              </div>
            </div>
          </div>

          {/* Profile Card */}
          <div className="p-4 mx-4 mt-4 rounded-2xl bg-gradient-to-br from-stone-50 to-stone-100/50 border border-stone-100">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-semibold text-lg shadow-md">
                  {(userProfile?.name || userProfile?.username || 'D')[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">
                  {userProfile?.name || userProfile?.username || 'Partner'}
                </p>
                <p className="text-xs text-stone-400">Online</p>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {sidebarItems.map((item, index) => (
              <motion.button
                key={index}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  item.active 
                    ? 'bg-amber-50 text-amber-700 font-medium' 
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1 text-sm">{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.active ? 'bg-amber-200 text-amber-800' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {item.count}
                  </span>
                )}
              </motion.button>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-stone-100">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-medium">Logout</span>
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-stone-100">
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-xl bg-stone-50 text-stone-500 hover:bg-stone-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </motion.button>
              <div>
                <h1 className="text-xl font-semibold text-stone-800">Dashboard</h1>
                <p className="text-sm text-stone-400">Welcome back, {userProfile?.name?.split(' ')[0] || 'Partner'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleRefresh}
                className={`p-2.5 rounded-xl bg-stone-50 text-stone-500 hover:bg-stone-100 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="relative p-2.5 rounded-xl bg-stone-50 text-stone-500 hover:bg-stone-100 transition-all"
              >
                <Bell className="h-5 w-5" />
                {activeOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {activeOrders.length}
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        <div className="p-4 lg:p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-amber-600" />
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
              </div>
              <p className="text-2xl font-bold text-stone-800">{activeOrders.length}</p>
              <p className="text-xs text-stone-400 mt-1">Active Deliveries</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-stone-800">{completedOrders.length}</p>
              <p className="text-xs text-stone-400 mt-1">Completed Today</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-violet-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-stone-800">
                {formatCurrency(orders.reduce((sum, o) => sum + o.total, 0)).replace('₹', '₹ ')}
              </p>
              <p className="text-xs text-stone-400 mt-1">Total Value</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl p-5 border border-stone-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-rose-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-stone-800">{orders.filter(o => o.status === 'outForDelivery').length}</p>
              <p className="text-xs text-stone-400 mt-1">Out for Delivery</p>
            </motion.div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 bg-stone-100/50 p-1.5 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'active' 
                  ? 'bg-white text-stone-800 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Active ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'completed' 
                  ? 'bg-white text-stone-800 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Completed ({completedOrders.length})
            </button>
          </div>

          {/* Orders Content */}
          {orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 px-4"
            >
              <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center mb-5">
                <Inbox className="h-10 w-10 text-stone-300" />
              </div>
              <h2 className="text-lg font-semibold text-stone-700 mb-2">No deliveries yet</h2>
              <p className="text-stone-400 text-center max-w-xs text-sm">
                New assignments will appear here when assigned by admin
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="text-sm">Refresh</span>
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'active' ? (
                activeOrders.length > 0 ? (
                  activeOrders.map((order, index) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      index={index}
                      onViewDetails={() => handleViewOrderDetails(order.id)}
                      formatCurrency={formatCurrency}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4 mx-auto">
                      <CheckCircle2 className="h-8 w-8 text-stone-300" />
                    </div>
                    <p className="text-stone-500">All caught up! No active deliveries.</p>
                  </div>
                )
              ) : (
                completedOrders.length > 0 ? (
                  completedOrders.map((order, index) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      index={index}
                      onViewDetails={() => handleViewOrderDetails(order.id)}
                      formatCurrency={formatCurrency}
                      isCompleted
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4 mx-auto">
                      <History className="h-8 w-8 text-stone-300" />
                    </div>
                    <p className="text-stone-500">No completed deliveries yet.</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

// Order Card Component
interface OrderCardProps {
  order: Order;
  index: number;
  onViewDetails: () => void;
  formatCurrency: (amount: number) => string;
  isCompleted?: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  order, 
  index, 
  onViewDetails, 
  formatCurrency,
  isCompleted = false 
}) => {
  const status = statusConfig[order.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all ${isCompleted ? 'opacity-70' : ''}`}
    >
      <div className="p-5">
        {/* Top row: Order ID & Status */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-medium mb-1">Order ID</p>
            <p className="font-mono text-lg font-bold text-stone-800">#{order.orderId}</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${status.bgColor} ${status.borderColor}`}>
            <div className={`w-2 h-2 rounded-full ${status.dotColor}`} />
            <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
          </div>
        </div>

        {/* Customer & Address */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-stone-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-700 truncate">{order.shippingAddress.fullName}</p>
              <p className="text-xs text-stone-400 truncate">{order.shippingAddress.mobile}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-stone-400" />
            </div>
            <p className="text-sm text-stone-500 leading-relaxed">
              {order.shippingAddress.locality || order.shippingAddress.city}, {order.shippingAddress.state}
            </p>
          </div>
        </div>

        {/* Bottom row: Amount & Action */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-0.5">Amount</p>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(order.total)}</p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewDetails}
            className="flex items-center gap-2 px-5 py-3 bg-stone-800 text-white rounded-xl text-sm font-medium transition-all hover:bg-stone-900"
          >
            View Details
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default DeliveryDashboard;
