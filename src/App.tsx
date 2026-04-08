import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Auth Provider
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import ShoppingCart from "@/components/ShoppingCart";

// Route Guards
import ProtectedRoute from "@/guards/ProtectedRoute";
import AdminRoute from "@/guards/AdminRoute";
import DeliveryRoute from "@/guards/DeliveryRoute";

// Public Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CategoryPage from "./pages/CategoryPage";
import ProductDetail from "./pages/ProductDetail";
import Contact from "./pages/Contact";
import About from "./pages/About";
import CustomerSupport from "./pages/CustomerSupport";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsConditions from "./pages/TermsConditions";
import ShippingPolicy from "./pages/ShippingPolicy";
import CancellationRefundPolicy from "./pages/CancellationRefundPolicy";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import Profile from "./pages/Profile";
import Account from "./pages/Account";
import SavedAddresses from "./pages/SavedAddresses";
import BuyAgain from "./pages/BuyAgain";
import LoadingScreen from "./components/LoadingScreen";
import ScrollToTop from "./components/ScrollToTop";
import MobileCart from "./pages/MobileCart";
import MobileOrders from "./pages/MobileOrders";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import CancelOrderPage from "./pages/CancelOrderPage";
import ProfileEditPage from "./pages/ProfileEditPage";
import MobileSearch from "./pages/MobileSearch";
import SearchResults from "./pages/SearchResults";

// Purchase Summary & Security Pages
import PurchaseSummary from "./pages/PurchaseSummary";
import SecurityPage from "./pages/SecurityPage";

// Auth Pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyEmail from "./pages/auth/VerifyEmail";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import ProductForm from "./pages/admin/ProductForm";
import Media from "./pages/admin/Media";
import AdminBanners from "./pages/AdminBanners";
import AdminShowcases from "./pages/admin/AdminShowcases";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminOrders from "./pages/AdminOrders";
import AdminDeliveryBoys from "./pages/admin/AdminDeliveryBoys";
import AdminGiftCards from "./pages/admin/AdminGiftCards";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminImagePrompts from "./pages/admin/AdminImagePrompts";import AdminCustomers from './pages/admin/AdminCustomers';import WriteReview from "./pages/WriteReview";
import ThankYouReview from "./pages/ThankYouReview";

// Delivery Partner Pages
import DeliveryLogin from "./pages/delivery/DeliveryLogin";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import DeliveryOrderDetails from "./pages/delivery/DeliveryOrderDetails";
import DeliveryMapPage from "./pages/delivery/DeliveryMapPage";

const queryClient = new QueryClient();

const App = () => {
  // Check if the app has been loaded before in this session
  const [isLoaded, setIsLoaded] = useState(() => {
    return sessionStorage.getItem('appLoaded') === 'true';
  });

  const handleLoadingComplete = () => {
    setIsLoaded(true);
    sessionStorage.setItem('appLoaded', 'true');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {!isLoaded && <LoadingScreen onComplete={handleLoadingComplete} />}
            <BrowserRouter>
              <ScrollToTop />
              <ShoppingCart />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              
              {/* Mobile Cart Page */}
              <Route path="/cart" element={<MobileCart />} />
              
              {/* Mobile Search Pages */}
              <Route path="/search" element={<MobileSearch />} />
              <Route path="/search-results" element={<SearchResults />} />
              
              {/* Category Pages – unified */}
              <Route path="/category/:categorySlug" element={<CategoryPage />} />
              
              {/* Legacy redirects */}
              <Route path="/jewelry" element={<Navigate to="/category/jewellery" replace />} />
              <Route path="/furniture" element={<Navigate to="/category/furniture" replace />} />
              <Route path="/articles" element={<Navigate to="/category/articles" replace />} />
              <Route path="/products" element={<Navigate to="/category/others" replace />} />
              <Route path="/home-decor" element={<Navigate to="/category/others" replace />} />
              <Route path="/gifts" element={<Navigate to="/category/articles" replace />} />
              
              <Route path="/product/:productId" element={<ProductDetail />} />
              <Route path="/write-review" element={
                <ProtectedRoute requireEmailVerification={false}>
                  <WriteReview />
                </ProtectedRoute>
              } />
              <Route path="/thank-you-review" element={
                <ProtectedRoute requireEmailVerification={false}>
                  <ThankYouReview />
                </ProtectedRoute>
              } />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              <Route path="/account" element={<Account />} />
              <Route path="/account/orders" element={<MobileOrders />} />
              <Route path="/account/orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="/account/orders/:orderId/cancel" element={<CancelOrderPage />} />
              <Route path="/account/profile-edit" element={<ProfileEditPage />} />
              <Route path="/account/addresses" element={<SavedAddresses />} />
              <Route path="/buy-again" element={<BuyAgain />} />
              <Route path="/wallet" element={
                <ProtectedRoute requireEmailVerification={false}>
                  <PurchaseSummary />
                </ProtectedRoute>
              } />
              <Route path="/purchase-summary" element={
                <ProtectedRoute requireEmailVerification={false}>
                  <PurchaseSummary />
                </ProtectedRoute>
              } />
              <Route path="/security" element={
                <ProtectedRoute requireEmailVerification={false}>
                  <SecurityPage />
                </ProtectedRoute>
              } />
              <Route path="/contact" element={<Contact />} />
              <Route path="/about" element={<About />} />
              <Route path="/customer-support" element={<CustomerSupport />} />
              
              {/* Policy Pages */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-conditions" element={<TermsConditions />} />
              <Route path="/shipping-policy" element={<ShippingPolicy />} />
              <Route path="/cancellation-refund-policy" element={<CancellationRefundPolicy />} />
              
              {/* Auth Routes - all point to Account page */}
              <Route path="/login" element={<Account />} />
              <Route path="/auth/login" element={<Account />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/signup" element={<Signup />} />
              <Route path="/auth/verify-email" element={<VerifyEmail />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/auth/action" element={<ResetPassword />} />
              <Route path="/__/auth/action" element={<ResetPassword />} />

              {/* Admin Login (separate from admin panel) */}
              <Route path="/admin" element={<AdminLogin />} />

              {/* Protected Admin Routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/:productId" element={<ProductForm />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="delivery-boys" element={<AdminDeliveryBoys />} />
                <Route path="media" element={<Media />} />
                <Route path="banners" element={<AdminBanners />} />
                <Route path="showcases" element={<AdminShowcases />} />
                <Route path="testimonials" element={<AdminTestimonials />} />
                <Route path="gallery" element={<AdminGallery />} />
                <Route path="gift-cards" element={<AdminGiftCards />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="image-prompts" element={<AdminImagePrompts />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="customers" element={<AdminCustomers />} />
              </Route>

              {/* Delivery Partner Routes */}
              <Route path="/delivery" element={<Navigate to="/account?tab=delivery" replace />} />
              <Route
                path="/delivery/dashboard"
                element={
                  <DeliveryRoute>
                    <DeliveryDashboard />
                  </DeliveryRoute>
                }
              />
              <Route
                path="/delivery/order/:orderId"
                element={
                  <DeliveryRoute>
                    <DeliveryOrderDetails />
                  </DeliveryRoute>
                }
              />
              <Route
                path="/delivery/map/:orderId"
                element={
                  <DeliveryRoute>
                    <DeliveryMapPage />
                  </DeliveryRoute>
                }
              />

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
