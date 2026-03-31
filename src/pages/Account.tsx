import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import CategoryIconNav from '@/components/CategoryIconNav';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import { subscribeToUserOrders, Order, updateOrderStatus, cancelOrder, requestReturn } from '@/services/orderService';
import { uploadToCloudinary, UploadProgress } from '@/services/cloudinaryService';
import { toast } from 'sonner';
import logo from '@/assets/dark.png';
import {
  Loader2,
  User,
  CreditCard,
  MapPin,
  Bell,
  Shield,
  HelpCircle,
  Heart,
  Package,
  LogOut,
  ChevronRight,
  Sparkles,
  Ticket,
  Globe,
  Star,
  MessageCircle,
  Mail,
  Lock,
  Eye,
  Settings,
  RotateCcw,
  EyeOff,
  Truck,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Ban,
  RotateCcw as ReturnIcon,
  AlertCircle,
  X,
  Edit,
  Phone,
} from 'lucide-react';

const Account = () => {
  const { user, userProfile, loading, logout } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is not authenticated, show login form
  if (!user) {
    return <LoginForm />;
  }

  // If user is authenticated, show account page
  return <AccountPage />;
};

// Login Form Component
type LoginTab = 'user' | 'delivery';

const LoginForm = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as LoginTab | null;
  const [activeTab, setActiveTab] = useState<LoginTab>(tabFromUrl === 'delivery' ? 'delivery' : 'user');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [sameForWhatsApp, setSameForWhatsApp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const { loginWithGoogle, login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Handle tab change
  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setIsSignUp(false);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setError('');
    setResetSent(false);
    // Update URL to reflect tab change
    if (tab === 'delivery') {
      setSearchParams({ tab: 'delivery' });
    } else {
      setSearchParams({});
    }
  };

  const handleGoogleSignIn = async () => {
    if (activeTab === 'delivery') {
      setError('Google Sign-In is not available for delivery partners.');
      return;
    }
    
    setError('');
    setGoogleLoading(true);

    try {
      const userProfile = await loginWithGoogle();
      
      // Check email verification for regular users
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified && userProfile.role === 'user') {
        sessionStorage.setItem('pendingVerificationEmail', currentUser.email || '');
        navigate('/verify-email', { state: { email: currentUser.email }, replace: true });
        // Don't reset loading - navigating away
        return;
      }
      
      if (userProfile.role === 'admin') {
        navigate('/admin/dashboard');
        // Don't reset loading - navigating away
        return;
      }
      
      // For regular verified users, stay on account page (component will re-render)
      setGoogleLoading(false);
    } catch (err: any) {
      console.error('Google login error:', err);
      setGoogleLoading(false);
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by browser. Please allow popups and try again.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized. Please contact support.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled. Please contact support.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Multiple popups detected. Please try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Failed to sign in with Google: ${err.message || 'Please try again.'}`);
      }
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (isSignUp && !fullName) {
      setError('Please enter your full name.');
      return;
    }

    if (isSignUp && phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (isSignUp && !agreeTerms) {
      setError('Please agree to the terms and conditions.');
      return;
    }

    setEmailLoading(true);

    try {
      if (isSignUp) {
        await signup(email, password, fullName, phone || undefined, sameForWhatsApp);
        // Navigate immediately to email verification page
        sessionStorage.setItem('pendingVerificationEmail', email);
        // Keep loading state active during navigation to prevent flash
        navigate('/verify-email', { state: { email }, replace: true });
        // Don't reset emailLoading - we're navigating away
        return;
      } else {
        const userProfile = await login(email, password);
        
        // Handle delivery login
        if (activeTab === 'delivery') {
          if (userProfile.role !== 'delivery') {
            setError('This login is for delivery partners only. Please use the User tab.');
            setEmailLoading(false);
            return;
          }
          navigate('/delivery/dashboard');
          // Don't reset loading - navigating away
          return;
        }
        
        // Handle user login - check they're not delivery
        if (userProfile.role === 'delivery') {
          setError('Delivery partners should use the Delivery tab to login.');
          setEmailLoading(false);
          return;
        }
        
        // Check email verification for regular users
        const currentUser = auth.currentUser;
        if (currentUser && !currentUser.emailVerified && userProfile.role === 'user') {
          sessionStorage.setItem('pendingVerificationEmail', email);
          navigate('/verify-email', { state: { email }, replace: true });
          // Don't reset loading - navigating away
          return;
        }
        
        if (userProfile.role === 'admin') {
          navigate('/admin/dashboard');
          // Don't reset loading - navigating away
          return;
        }
        
        // For regular verified users, stay on account page (component will re-render)
        setEmailLoading(false);
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setEmailLoading(false);
      
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      setError('');
    } catch (err: any) {
      setError('Failed to send reset email. Please check your email address.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted">
      {/* Site Header */}
      <Header />

      {/* Content area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-card rounded-2xl shadow-lg border border-border p-6 sm:p-8"
        >
          {/* Tabs */}
          <div className="flex mb-6 bg-muted rounded-full p-1">
            <button
              onClick={() => handleTabChange('user')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                activeTab === 'user'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <User className="h-4 w-4" />
              User
            </button>
            <button
              onClick={() => handleTabChange('delivery')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all ${
                activeTab === 'delivery'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground/80'
              }`}
            >
              <Truck className="h-4 w-4" />
              Delivery
            </button>
          </div>

          {/* Header */}
          <div className="text-center mb-5">
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {activeTab === 'delivery' 
                ? 'Delivery Partner Login' 
                : (isSignUp ? 'Create Account' : 'Welcome Back')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {activeTab === 'delivery'
                ? 'Access your delivery dashboard'
                : (isSignUp ? 'Sign up to get started' : 'Please login to your account')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4"
            >
              <p className="text-red-600 text-sm text-center">{error}</p>
            </motion.div>
          )}

          {/* Reset Password Success */}
          {resetSent && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4"
            >
              <p className="text-green-600 text-sm text-center">Password reset email sent! Check your inbox.</p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            {/* Full Name - only for Sign Up (User tab only) */}
            {activeTab === 'user' && isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted/50"
                  />
                </div>
              </motion.div>
            )}

            {/* Phone Number - only for Sign Up (User tab only) */}
            {activeTab === 'user' && isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter your phone number"
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted/50"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={sameForWhatsApp}
                    onChange={(e) => setSameForWhatsApp(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">Same number for WhatsApp</span>
                </div>
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted/50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-foreground/80">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-11 pr-12 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-muted/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms Agreement - User tab sign up only */}
            {activeTab === 'user' && isSignUp && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">
                  I agree to all <span className="text-primary cursor-pointer">Terms</span>, <span className="text-primary cursor-pointer">Privacy Policy</span> and fees
                </span>
              </div>
            )}

            {/* Sign In / Sign Up Button */}
            <Button
              type="submit"
              disabled={emailLoading}
              className="w-full py-3 h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-primary/25"
            >
              {emailLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isSignUp ? 'Creating Account...' : 'Logging in...'}
                </>
              ) : (
                isSignUp ? 'Sign Up' : 'Login'
              )}
            </Button>
          </form>

          {/* Divider - User tab only */}
          {activeTab === 'user' && (
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">Or Login with</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Social Sign In - User tab only */}
          {activeTab === 'user' && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 border border-border rounded-xl text-sm font-medium text-foreground/80 hover:bg-muted transition-all disabled:opacity-50 bg-card"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? 'Signing In...' : 'Google'}
            </button>
          )}

          {/* Toggle Sign In / Sign Up - User tab only */}
          {activeTab === 'user' && (
            <div className="text-center mt-6">
              <span className="text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              </span>
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setResetSent(false);
                }}
                className="text-sm text-primary font-semibold hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign up'}
              </button>
            </div>
          )}

          {/* Delivery Help Text */}
          {activeTab === 'delivery' && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Contact admin if you need your delivery account credentials.
            </p>
          )}
        </motion.div>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
};

// Account Page Component
const AccountPage = () => {
  const navigate = useNavigate();
  const { logout, userProfile, user, updateUserProfile } = useAuth();
  const [selectedMenu, setSelectedMenu] = useState('orders');
  const [selectedOrderTab, setSelectedOrderTab] = useState('current');
  const [isMobile, setIsMobile] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Update avatar URL when user or userProfile changes
  useEffect(() => {
    const newAvatarUrl = userProfile?.avatar || user?.photoURL || null;
    console.log('🖼️ Avatar URL updated:', newAvatarUrl);
    setAvatarUrl(newAvatarUrl);
  }, [userProfile?.avatar, user?.photoURL]);

  // Handle photo upload
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const result = await uploadToCloudinary(file, (progress: UploadProgress) => {
        console.log(`Upload progress: ${progress.percentage}%`);
      });

      await updateUserProfile({ avatar: result.secure_url });
      setAvatarUrl(result.secure_url);
      toast.success('Profile photo updated successfully');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    
    if (confirmed) {
      try {
        // TODO: Implement account deletion logic
        toast.success('Account deletion requested. Please contact support.');
      } catch (error) {
        console.error('Error deleting account:', error);
        toast.error('Failed to delete account. Please try again.');
      }
    }
  };

  // Subscribe to user orders
  useEffect(() => {
    if (!user) return;

    console.log('Setting up order subscription for user:', user.uid);
    setOrdersLoading(true);
    
    const unsubscribe = subscribeToUserOrders(
      user.uid,
      (fetchedOrders) => {
        console.log('📦 [Account] Real-time update received!');
        console.log('📦 [Account] Number of orders:', fetchedOrders.length);
        console.log('📦 [Account] Order details:', fetchedOrders.map(o => ({
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
        console.error('Error details:', error.message, (error as any).code);
        
        // Check if it's an index error
        if (error.message?.includes('index') || error.message?.includes('requires an index')) {
          console.error('FIRESTORE INDEX REQUIRED: Please create the composite index for orders collection');
          console.error('Follow the link in the error message above or check the browser console');
        }
        
        setOrdersLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up order subscription');
      unsubscribe();
    };
  }, [user]);

  // Sync selected order with updated orders data (for real-time updates in detail view)
  useEffect(() => {
    if (selectedOrder && orders.length > 0) {
      const updatedOrder = orders.find(order => order.id === selectedOrder.id);
      if (updatedOrder) {
        console.log('🔄 [Account] Syncing selected order with real-time data');
        setSelectedOrder(updatedOrder);
      }
    }
  }, [orders]);

  // Detect mobile
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Redirect to wishlist on mobile (account section is available there)
  React.useEffect(() => {
    if (isMobile) {
      navigate('/wishlist');
    }
  }, [isMobile, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    { id: 'orders', label: 'My orders', icon: Package, path: null },
    { id: 'editProfile', label: 'Edit Profile', icon: Edit, path: '/account/profile-edit' },
    { id: 'addresses', label: 'Your addresses', icon: MapPin, path: '/account/addresses' },
    { id: 'security', label: 'Login & security', icon: Shield, path: '/security' },
    { id: 'saved', label: 'Saved items', icon: Heart, path: '/wishlist' },
    { id: 'support', label: 'Customer support', icon: MessageCircle, path: '/customer-support' },
    { id: 'logout', label: 'Log out', icon: LogOut, path: null, action: 'logout' },
  ];

  const quickAccessCards = [
    { id: 'orders', label: 'Orders', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', path: '/orders' },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50', path: '/wishlist' },
    { id: 'coupons', label: 'Coupons', icon: Ticket, color: 'text-orange-600', bg: 'bg-orange-50', path: '/coupons' },
    { id: 'help', label: 'Help Center', icon: HelpCircle, color: 'text-green-600', bg: 'bg-green-50', path: '/help' },
  ];

  const accountSettings = [
    { id: 'plus', label: 'Premium Plus', icon: Sparkles, color: 'text-yellow-600', path: '/premium' },
    { id: 'profile', label: 'Edit Profile', icon: User, color: 'text-blue-600', path: '/account/profile' },
    { id: 'cards', label: 'Saved Credit / Debit & Gift Cards', icon: CreditCard, color: 'text-purple-600', path: '/account/cards' },
    { id: 'addresses', label: 'Saved Addresses', icon: MapPin, color: 'text-red-600', path: '/account/addresses' },
    { id: 'language', label: 'Select Language', icon: Globe, color: 'text-blue-600', path: '/account/language' },
    { id: 'notifications', label: 'Notification Settings', icon: Bell, color: 'text-green-600', path: '/account/notifications' },
    { id: 'privacy', label: 'Privacy Center', icon: Shield, color: 'text-gray-600', path: '/account/privacy' },
  ];

  const myActivity = [
    { id: 'reviews', label: 'Reviews', icon: Star, color: 'text-yellow-600' },
    { id: 'questions', label: 'Questions & Answers', icon: MessageCircle, color: 'text-blue-600' },
  ];

  // Filter orders based on selected tab
  const filteredOrders = orders.filter(order => {
    if (selectedOrderTab === 'current') {
      return ['pending', 'processing', 'shipped', 'outForDelivery'].includes(order.status);
    } else if (selectedOrderTab === 'all') {
      return true;
    }
    return false;
  });

  // Format price in INR
  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  // Get status color - sophisticated palette
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'text-amber-600';
      case 'processing':
        return 'text-orange-600';
      case 'shipped':
        return 'text-blue-600';
      case 'outForDelivery':
        return 'text-indigo-600';
      case 'delivered':
        return 'text-emerald-600';
      case 'cancelled':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Get status badge classes
  const getStatusBadgeClass = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'processing':
        return 'bg-orange-50 text-orange-700 border border-orange-200';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'outForDelivery':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border border-red-200';
      case 'returnRequested':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'returnScheduled':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'returned':
        return 'bg-gray-50 text-gray-700 border border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
    }
  };

  // Get status icon
  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'processing':
        return <Package className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'outForDelivery':
        return <MapPin className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'returnRequested':
        return <ReturnIcon className="w-4 h-4" />;
      case 'returnScheduled':
        return <ReturnIcon className="w-4 h-4" />;
      case 'returned':
        return <ReturnIcon className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  // Get status label
  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'shipped':
        return 'Shipped';
      case 'outForDelivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      case 'returnRequested':
        return 'Return Requested';
      case 'returnScheduled':
        return 'Return Scheduled';
      case 'returned':
        return 'Returned';
      default:
        return status;
    }
  };

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Format payment method
  const formatPaymentMethod = (method: string) => {
    if (method === 'cod') return 'Cash On Delivery';
    if (method === 'online') return 'Online Payment';
    if (method === 'card') return 'Card Payment';
    // Capitalize first letter of each word
    return method.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Check if order can be returned (within 7 days of delivery)
  const canReturnOrder = (order: Order): boolean => {
    if (order.status !== 'delivered' || !order.deliveredAt) return false;
    
    const deliveredDate = order.deliveredAt.toDate();
    const now = new Date();
    const hoursSinceDelivery = (now.getTime() - deliveredDate.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceDelivery <= 168; // Within 7 days (168 hours)
  };

  // Handle cancel order
  const handleCancelOrder = async () => {
    if (!selectedOrder || !user || !cancelReason) return;
    
    setIsSubmitting(true);
    try {
      await cancelOrder(selectedOrder.id, user.uid, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      // Order will update via real-time subscription
      alert('Order cancelled successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to cancel order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle request return
  const handleRequestReturn = async () => {
    if (!selectedOrder || !user || !returnReason) return;
    
    setIsSubmitting(true);
    try {
      await requestReturn(selectedOrder.id, user.uid, returnReason);
      setShowReturnModal(false);
      setReturnReason('');
      // Order will update via real-time subscription
      alert('Return request submitted successfully. Our team will review your request.');
    } catch (error: any) {
      alert(error.message || 'Failed to submit return request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMenuClick = (menu: any) => {
    if (menu.action === 'logout') {
      handleLogout();
    } else if (menu.path) {
      navigate(menu.path);
    } else {
      setSelectedMenu(menu.id);
    }
  };

  // Mobile view - new design matching desktop
  if (isMobile) {
    return (
      <>
        <div className="min-h-screen pt-2 bg-muted pb-20" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <div className="px-4 py-2">
            {/* Amazon-style Account Header */}
            <div className="bg-card rounded-lg shadow-sm p-4 mb-4">
              {/* Top Row: User info and icons */}
              <div className="flex items-center justify-between mb-4">
                {/* User Avatar and Name */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate('/')}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-foreground/80" />
                  </button>
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img 
                        key={`avatar-${avatarUrl}-${user?.uid}`}
                        src={avatarUrl} 
                        alt="Profile" 
                        className="w-10 h-10 rounded-full object-cover border border-black flex-shrink-0"
                        referrerPolicy="no-referrer"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border border-black flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {(userProfile?.name || userProfile?.username || user?.email?.split('@')[0] || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground">
                      Hello, {(userProfile?.name || userProfile?.username || user?.email?.split('@')[0] || 'User').slice(0, 12)}...
                    </span>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {/* Quick Action Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <button 
                  onClick={() => navigate('/account/orders')}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium text-foreground/80 bg-card border border-border rounded-full hover:bg-muted transition-colors"
                >
                  Orders
                </button>
                <button 
                  onClick={() => navigate('/buy-again')}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium text-foreground/80 bg-card border border-border rounded-full hover:bg-muted transition-colors"
                >
                  Buy Again
                </button>
                <button 
                  onClick={() => navigate('/wishlist')}
                  className="flex-shrink-0 px-4 py-2 text-sm font-medium text-foreground/80 bg-card border border-border rounded-full hover:bg-muted transition-colors"
                >
                  Lists
                </button>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="bg-card rounded-lg shadow-sm mb-4">
              {menuItems.filter(item => item.id !== 'orders' && item.id !== 'archived' && item.id !== 'saved').map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 text-left transition-colors ${
                    item.id === 'logout'
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                      : selectedMenu === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/80'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Main Content */}
            {selectedMenu === 'addresses' && (
              <div className="bg-card rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-bold text-foreground mb-2">Your Addresses</h3>
                <p className="text-sm text-muted-foreground mb-4">Manage your saved addresses here.</p>
                <Button onClick={() => navigate('/account/addresses')} className="w-full">
                  View Addresses
                </Button>
              </div>
            )}

            {selectedMenu === 'security' && (
              <div className="bg-card rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-bold text-foreground mb-2">Login & Security</h3>
                <p className="text-sm text-muted-foreground mb-4">Manage your login credentials and security settings.</p>
                <Button onClick={() => navigate('/security')} className="w-full">Manage Security</Button>
              </div>
            )}

            {selectedMenu === 'support' && (
              <div className="bg-card rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-bold text-foreground mb-2">Customer Support</h3>
                <p className="text-sm text-muted-foreground">Get help with your orders and account.</p>
              </div>
            )}
          </div>
        </div>
        <MobileBottomNav />

        {/* Order Details Full Page - Mobile */}
        <AnimatePresence>
          {showOrderModal && selectedOrder && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-0 bg-card z-50 overflow-y-auto"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center gap-3 z-10">
                <button 
                  onClick={() => setShowOrderModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground/80" />
                </button>
                <h3 className="text-lg font-semibold text-foreground">My Orders</h3>
              </div>
              
              <div className="p-4 pb-24 space-y-5">
                {/* Order ID & Status */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Order ID</p>
                  <h4 className="text-lg font-bold text-foreground">#{selectedOrder.orderId}</h4>
                  <span className={`inline-flex items-center gap-1.5 mt-2 text-sm font-medium px-3 py-1 rounded-full ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                  {/* Status message for return flow */}
                  {selectedOrder.status === 'returnRequested' && (
                    <p className="text-sm text-amber-700 mt-2">Return request submitted. Waiting for approval.</p>
                  )}
                  {selectedOrder.status === 'returnScheduled' && (
                    <p className="text-sm text-emerald-700 mt-2">Return approved! Pickup will be scheduled soon.</p>
                  )}
                  {selectedOrder.status === 'returned' && (
                    <p className="text-sm text-muted-foreground mt-2">Item has been picked up and returned successfully.</p>
                  )}
                </div>

                {/* Items Section */}
                <div>
                  <h5 className="text-base font-semibold text-foreground mb-3">Items</h5>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 bg-muted rounded-xl p-3">
                        <div className="w-16 h-16 bg-card rounded-lg flex-shrink-0 overflow-hidden border border-border">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h6 className="text-sm font-semibold text-foreground mb-1">{item.name}</h6>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item.price.toLocaleString()}</p>
                          <p className="text-sm font-bold text-foreground mt-1">₹{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Information Section - Mobile */}
                {(selectedOrder.trackingId || selectedOrder.carrier) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <Truck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <span className="font-semibold text-foreground text-sm block">Tracking Information</span>
                        <span className="text-xs text-muted-foreground">Track your package</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      {selectedOrder.carrier && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Carrier:</span>
                          <span className="font-semibold text-foreground">{selectedOrder.carrier}</span>
                        </div>
                      )}
                      {selectedOrder.trackingId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID:</span>
                          <span className="font-mono font-semibold text-blue-600">{selectedOrder.trackingId}</span>
                        </div>
                      )}
                      {selectedOrder.trackingUrl && (
                        <a
                          href={selectedOrder.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 mt-3 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl w-full"
                        >
                          <Truck className="w-4 h-4" />
                          Track Package
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                <div>
                  <h5 className="text-base font-semibold text-foreground mb-3">Shipping Address</h5>
                  <div className="bg-muted rounded-xl p-4">
                    <p className="font-semibold text-foreground mb-1">{selectedOrder.shippingAddress.fullName}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.shippingAddress.address}</p>
                    {selectedOrder.shippingAddress.locality && (
                      <p className="text-sm text-muted-foreground">{selectedOrder.shippingAddress.locality}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.pincode}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Phone:</span> {selectedOrder.shippingAddress.mobile}
                    </p>
                  </div>
                </div>

                {/* Payment Summary */}
                <div>
                  <h5 className="text-base font-semibold text-foreground mb-3">Payment Summary</h5>
                  <div className="bg-muted rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">₹{selectedOrder.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="text-foreground">₹{selectedOrder.deliveryCharge.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="text-foreground">₹{selectedOrder.taxAmount.toLocaleString()}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-₹{selectedOrder.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-semibold text-foreground">Total</span>
                        <span className="font-bold text-lg text-foreground">₹{selectedOrder.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-medium text-foreground">{formatPaymentMethod(selectedOrder.paymentMethod)}</span>
                    </div>
                  </div>
                </div>

                {/* Order Date */}
                <div className="text-center text-xs text-muted-foreground pt-2">
                  Ordered on {formatDate(selectedOrder.createdAt)}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop view - new sidebar layout
  return (
    <>
      <Header />
      <CategoryIconNav />
      <div className="pt-6 bg-muted" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <div className="container mx-auto px-6 pb-8">
          <div className="grid grid-cols-12 gap-6 -mt-4">
            {/* Sidebar */}
            <div className="col-span-3">
              <div className="bg-card rounded-lg shadow-sm p-6 sticky top-20">
                {/* User Info */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-foreground mb-1">Your Account</h2>
                  <p className="text-sm text-muted-foreground font-medium" style={{ wordBreak: 'break-all' }}>{userProfile?.username || 'User'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5" style={{ wordBreak: 'break-all' }}>{userProfile?.email || user?.email}</p>
                </div>

                {/* Menu Items */}
                <nav className="space-y-1">
                  {menuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick(item)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        selectedMenu === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground/80 hover:bg-muted'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main Content */}
            <div className="col-span-9">
              {selectedMenu === 'orders' && (
                <div className="bg-card rounded-lg shadow-sm">
                  {/* Order Tabs */}
                  <div className="border-b border-border px-6 pt-6">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setSelectedOrderTab('current')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          selectedOrderTab === 'current'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Current
                      </button>
                      <button
                        onClick={() => setSelectedOrderTab('all')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          selectedOrderTab === 'all'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        All orders
                      </button>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="p-6 space-y-6">
                    {ordersLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    ) : filteredOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-1">No orders yet!</h3>
                        <p className="text-sm text-muted-foreground mb-6">Discover stunning silver jewellery crafted just for you</p>
                        <button
                          onClick={() => navigate('/category/jewellery')}
                          className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          ✨ Start Shopping
                        </button>
                      </div>
                    ) : (
                      filteredOrders.map((order) => (
                        <div 
                          key={order.id} 
                          className="border border-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow bg-muted"
                          style={{ fontFamily: "'Poppins', sans-serif" }}
                          onClick={() => {
                            navigate(`/account/orders/${order.id}`);
                          }}
                        >
                          {/* Order Items Display */}
                          <div className="space-y-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex gap-4">
                                <div className="w-20 h-20 bg-card rounded-lg flex-shrink-0 overflow-hidden">
                                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-semibold text-foreground mb-1">{item.name}</h4>
                                  <p className="text-sm text-muted-foreground">Price: {formatPrice(item.price)}</p>
                                  <p className="text-sm text-muted-foreground">Quantity: {item.quantity}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                                      {getStatusIcon(order.status)}
                                      {getStatusLabel(order.status)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">•</span>
                                    <span className="text-sm text-muted-foreground">{formatDate(order.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Tracking Information - Real-time updated */}
                          {(order.trackingId || order.carrier) && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                                    <Truck className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    {order.carrier && (
                                      <p className="text-sm font-medium text-foreground">{order.carrier}</p>
                                    )}
                                    {order.trackingId && (
                                      <p className="text-xs text-muted-foreground">Tracking ID: {order.trackingId}</p>
                                    )}
                                  </div>
                                </div>
                                {order.trackingUrl && (
                                  <a
                                    href={order.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    Track Package
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {/* OTP Display for Out for Delivery Orders */}
                          {order.status === 'outForDelivery' && order.delivery_otp && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <p className="text-sm font-semibold text-foreground">Delivery OTP</p>
                              <p className="text-xs text-muted-foreground mt-1">Share this OTP with your delivery partner</p>
                              <p className="text-base font-bold text-foreground mt-2">{order.delivery_otp}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedMenu === 'addresses' && (
                <div className="bg-card rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">Your Addresses</h3>
                  <p className="text-muted-foreground">Manage your saved addresses here.</p>
                  <Button onClick={() => navigate('/account/addresses')} className="mt-4">
                    View Addresses
                  </Button>
                </div>
              )}

              {selectedMenu === 'security' && (
                <div className="bg-card rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">Login & Security</h3>
                  <p className="text-muted-foreground mb-4">Manage your login credentials and security settings.</p>
                  <Button onClick={() => navigate('/security')}>Manage Security</Button>
                </div>
              )}

              {selectedMenu === 'support' && (
                <div className="bg-card rounded-lg shadow-sm p-6">
                  <h3 className="text-xl font-bold text-foreground mb-4">Customer Support</h3>
                  <p className="text-muted-foreground">Get help with your orders and account.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {/* Order Details Modal - Desktop */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ fontFamily: "'Poppins', sans-serif" }}>
            <div className="sticky top-0 bg-card border-b border-border p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-foreground">Order Details</h3>
              <button 
                onClick={() => setShowOrderModal(false)}
                className="text-muted-foreground hover:text-foreground/80 text-2xl"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Order Number */}
              <div>
                <h4 className="text-xl font-bold text-foreground">Order #: {selectedOrder.orderId}</h4>
                <p className="text-base text-muted-foreground mt-2">
                  {selectedOrder.items.length} Products | By sree rasthu silvers | {formatDate(selectedOrder.createdAt)}
                </p>
              </div>

              {/* Order Details Grid */}
              <div className="space-y-4 text-base">
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <span className={`inline-flex items-center gap-1.5 font-semibold text-lg px-3 py-1 rounded-full ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusLabel(selectedOrder.status)}
                  </span>
                </div>

                {/* Return Status Message */}
                {(selectedOrder.status === 'returnRequested' || selectedOrder.status === 'returnScheduled' || selectedOrder.status === 'returned') && (
                  <div className={`p-4 rounded-xl border ${
                    selectedOrder.status === 'returnRequested' ? 'bg-amber-50 border-amber-200' :
                    selectedOrder.status === 'returnScheduled' ? 'bg-emerald-50 border-emerald-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        selectedOrder.status === 'returnRequested' ? 'bg-amber-100' :
                        selectedOrder.status === 'returnScheduled' ? 'bg-emerald-100' :
                        'bg-gray-100'
                      }`}>
                        <ReturnIcon className={`w-5 h-5 ${
                          selectedOrder.status === 'returnRequested' ? 'text-amber-600' :
                          selectedOrder.status === 'returnScheduled' ? 'text-emerald-600' :
                          'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <h5 className={`font-semibold ${
                          selectedOrder.status === 'returnRequested' ? 'text-amber-800' :
                          selectedOrder.status === 'returnScheduled' ? 'text-emerald-800' :
                          'text-gray-800'
                        }`}>
                          {selectedOrder.status === 'returnRequested' && 'Return Request Pending'}
                          {selectedOrder.status === 'returnScheduled' && 'Return Approved'}
                          {selectedOrder.status === 'returned' && 'Return Complete'}
                        </h5>
                        <p className={`text-sm mt-1 ${
                          selectedOrder.status === 'returnRequested' ? 'text-amber-700' :
                          selectedOrder.status === 'returnScheduled' ? 'text-emerald-700' :
                          'text-gray-600'
                        }`}>
                          {selectedOrder.status === 'returnRequested' && 'Your return request is being reviewed by our team.'}
                          {selectedOrder.status === 'returnScheduled' && 'Your return has been approved! Pickup will be scheduled soon.'}
                          {selectedOrder.status === 'returned' && 'Your item has been picked up and returned successfully.'}
                        </p>
                        {selectedOrder.returnReason && (
                          <p className="text-xs text-muted-foreground mt-2">Reason: {selectedOrder.returnReason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tracking Information Section - Real-time updated */}
                {(selectedOrder.trackingId || selectedOrder.carrier) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <Truck className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h5 className="font-semibold text-foreground">Tracking Information</h5>
                        <p className="text-xs text-muted-foreground">Updated in real-time</p>
                      </div>
                    </div>
                    <div className="space-y-2 pl-13">
                      {selectedOrder.carrier && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Carrier:</span>
                          <span className="text-sm font-semibold text-foreground">{selectedOrder.carrier}</span>
                        </div>
                      )}
                      {selectedOrder.trackingId && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Tracking ID:</span>
                          <span className="text-sm font-mono font-semibold text-blue-600">{selectedOrder.trackingId}</span>
                        </div>
                      )}
                      {selectedOrder.trackingUrl && (
                        <div className="mt-3">
                          <a
                            href={selectedOrder.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
                          >
                            <Truck className="w-4 h-4" />
                            Track Package
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OTP Delivery Verification - Shown when out for delivery */}
                {selectedOrder.status === 'outForDelivery' && selectedOrder.delivery_otp && (
                  <div className="py-3 border-b border-border">
                    <p className="text-sm font-semibold text-foreground">Delivery OTP</p>
                    <p className="text-xs text-muted-foreground mt-1">Share this OTP with your delivery partner</p>
                    <p className="text-base font-bold text-foreground mt-2">{selectedOrder.delivery_otp}</p>
                  </div>
                )}
                
                <div className="flex justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium">Payment:</span>
                  <span className="font-semibold text-foreground">
                    {formatPaymentMethod(selectedOrder.paymentMethod)}
                  </span>
                </div>
                
                <div className="py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium block mb-2">Delivered to:</span>
                  <span className="font-semibold text-foreground">
                    {selectedOrder.shippingAddress.address}, {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}
                  </span>
                </div>
                
                <div className="flex justify-between py-3">
                  <span className="text-muted-foreground font-medium text-lg">Total:</span>
                  <span className="font-bold text-foreground text-2xl">
                    {formatPrice(selectedOrder.total)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border">
                {/* Cancel Order Button - Only for pending/processing orders */}
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'processing') && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowCancelModal(true)}
                      className="flex-1 py-3 px-4 border-2 border-red-200 bg-red-50 rounded-lg text-sm font-semibold text-red-700 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                    >
                      <Ban className="w-4 h-4" />
                      Cancel Order
                    </button>
                    <button 
                      onClick={() => {
                        const phoneNumber = '919819873745';
                        const message = encodeURIComponent(
                          `Hello! I need assistance regarding my order:\n\nOrder ID: ORD-${selectedOrder.orderId}\nProduct: ${selectedOrder.items[0]?.name}${selectedOrder.items.length > 1 ? ` +${selectedOrder.items.length - 1} more items` : ''}\nStatus: ${getStatusLabel(selectedOrder.status)}\n\nPlease help me with my product enquiry.`
                        );
                        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                      }}
                      className="flex-1 py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat with us
                    </button>
                  </div>
                )}

                {/* Return Items Button - Only for delivered orders within 7 days */}
                {canReturnOrder(selectedOrder) && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowReturnModal(true)}
                      className="flex-1 py-3 px-4 border-2 border-emerald-200 bg-emerald-50 rounded-lg text-sm font-semibold text-emerald-700 flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
                    >
                      <ReturnIcon className="w-4 h-4" />
                      Return Items
                    </button>
                    <button 
                      onClick={() => {
                        const phoneNumber = '919819873745';
                        const message = encodeURIComponent(
                          `Hello! I need assistance regarding my order:\n\nOrder ID: ORD-${selectedOrder.orderId}\nProduct: ${selectedOrder.items[0]?.name}${selectedOrder.items.length > 1 ? ` +${selectedOrder.items.length - 1} more items` : ''}\nStatus: ${getStatusLabel(selectedOrder.status)}\n\nPlease help me with my product enquiry.`
                        );
                        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                      }}
                      className="flex-1 py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat with us
                    </button>
                  </div>
                )}

                {/* Chat Button - For other statuses where cancel/return not applicable */}
                {selectedOrder.status !== 'pending' && 
                 selectedOrder.status !== 'processing' && 
                 !canReturnOrder(selectedOrder) &&
                 selectedOrder.status !== 'cancelled' && (
                  <button 
                    onClick={() => {
                      const phoneNumber = '919819873745';
                      const message = encodeURIComponent(
                        `Hello! I need assistance regarding my order:\n\nOrder ID: ORD-${selectedOrder.orderId}\nProduct: ${selectedOrder.items[0]?.name}${selectedOrder.items.length > 1 ? ` +${selectedOrder.items.length - 1} more items` : ''}\nStatus: ${getStatusLabel(selectedOrder.status)}\n\nPlease help me with my product enquiry.`
                      );
                      window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                    }}
                    className="w-full py-3 px-4 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat with us
                  </button>
                )}
              </div>

              {/* Track Package Button */}
              {selectedOrder.trackingUrl && (
                <div className="pt-2">
                  <a
                    href={selectedOrder.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Truck className="w-4 h-4" />
                    Track Package
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Cancel Order</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Order ID: <span className="font-semibold">ORD-{selectedOrder.orderId}</span></p>
              <p className="text-sm text-muted-foreground mb-4">Please select a reason for cancellation:</p>
              
              <div className="space-y-2">
                {[
                  'Changed my mind',
                  'Ordered by mistake',
                  'Found a better price',
                  'Need to change delivery address',
                  'Other reason'
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setCancelReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      cancelReason === reason
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-border hover:border-red-200 hover:bg-red-50/50'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="flex-1 py-3 px-4 border border-border rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={!cancelReason || isSubmitting}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Confirm Cancellation'
                )}
              </button>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              This action cannot be undone
            </p>
          </motion.div>
        </div>
      )}

      {/* Return Request Modal */}
      {showReturnModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground">Request Return</h3>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Order ID: <span className="font-semibold">ORD-{selectedOrder.orderId}</span></p>
              <p className="text-sm text-muted-foreground mb-4">Please select a reason for return:</p>
              
              <div className="space-y-2">
                {[
                  'Defective item',
                  'Wrong size or fit',
                  'Quality not as expected',
                  'Received wrong product',
                  'Product damaged during delivery',
                  'Other reason'
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReturnReason(reason)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      returnReason === reason
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-border hover:border-emerald-200 hover:bg-emerald-50/50'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Returns are accepted within 7 days of delivery. Our team will review your request within 24-48 hours.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnReason('');
                }}
                className="flex-1 py-3 px-4 border border-border rounded-lg text-sm font-medium text-foreground/80 hover:bg-muted transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleRequestReturn}
                disabled={!returnReason || isSubmitting}
                className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Account;