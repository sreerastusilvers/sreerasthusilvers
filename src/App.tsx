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
import ShopNecklaces from "./pages/ShopNecklaces";
import ShopRings from "./pages/ShopRings";
import ShopBracelets from "./pages/ShopBracelets";
import ShopAnklets from "./pages/ShopAnklets";
import ShopPendants from "./pages/ShopPendants";
import ShopEarrings from "./pages/ShopEarrings";
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
import MobileCategories from "./pages/MobileCategories";
import MobileSearch from "./pages/MobileSearch";
import SearchResults from "./pages/SearchResults";

// Bracelet Category Pages
import DiamondBracelets from "./pages/categories/DiamondBracelets";
import GemstoneBracelets from "./pages/categories/GemstoneBracelets";
import PearlBracelets from "./pages/categories/PearlBracelets";
import GoldBracelets from "./pages/categories/GoldBracelets";
import SilverBracelets from "./pages/categories/SilverBracelets";
import BangleBracelets from "./pages/categories/BangleBracelets";

// Necklace Category Pages
import DiamondNecklaces from "./pages/categories/DiamondNecklaces";
import GemstoneNecklaces from "./pages/categories/GemstoneNecklaces";
import PearlNecklaces from "./pages/categories/PearlNecklaces";
import GoldNecklaces from "./pages/categories/GoldNecklaces";
import SilverNecklaces from "./pages/categories/SilverNecklaces";
import CrossNecklaces from "./pages/categories/CrossNecklaces";

// Ring Category Pages
import DiamondRings from "./pages/categories/DiamondRings";
import GemstoneRings from "./pages/categories/GemstoneRings";
import WeddingRings from "./pages/categories/WeddingRings";
import EngagementRings from "./pages/categories/EngagementRings";
import GoldRings from "./pages/categories/GoldRings";
import FashionRings from "./pages/categories/FashionRings";

// Jewelry Category Pages
import JewelryCollections from "./pages/JewelryCollections";
import MensJewelry from "./pages/MensJewelry";
import BirthstoneJewelry from "./pages/BirthstoneJewelry";
import PearlJewelry from "./pages/PearlJewelry";
import RoseGoldJewelry from "./pages/RoseGoldJewelry";
import NewArrivals from "./pages/NewArrivals";
import JewelrySale from "./pages/JewelrySale";

// Furniture Pages
import FurnitureCollections from "./pages/FurnitureCollections";
import SilverSofaCollection from "./pages/SilverSofaCollection";
import RoyalSilverChairs from "./pages/RoyalSilverChairs";
import RoyalSilverTables from "./pages/RoyalSilverTables";
import AntiqueSilverDecor from "./pages/AntiqueSilverDecor";
import SilverSwingJhoola from "./pages/SilverSwingJhoola";
import SilverCradles from "./pages/SilverCradles";
import SilverThrones from "./pages/SilverThrones";

// Articles Pages
import ArticlesCollections from "./pages/ArticlesCollections";
import SilverPoojaItems from "./pages/SilverPoojaItems";
import SilverGiftArticles from "./pages/SilverGiftArticles";
import SilverLamps from "./pages/SilverLamps";
import SilverPlates from "./pages/SilverPlates";
import SilverIdols from "./pages/SilverIdols";
import SilverVessels from "./pages/SilverVessels";

// Other Products Pages
import OtherProductsCollections from "./pages/OtherProductsCollections";
import SilverCoins from "./pages/SilverCoins";
import SilverBars from "./pages/SilverBars";
import SilverUtensils from "./pages/SilverUtensils";
import BabyItems from "./pages/BabyItems";
import AntiqueSilver from "./pages/AntiqueSilver";
import CustomOrders from "./pages/CustomOrders";

// Home Decor Pages
import HomeDecorCollections from "./pages/HomeDecorCollections";
import SilverWallDecor from "./pages/SilverWallDecor";
import SilverPhotoFrames from "./pages/SilverPhotoFrames";
import SilverShowpieces from "./pages/SilverShowpieces";
import SilverCandleStands from "./pages/SilverCandleStands";
import SilverFlowerVases from "./pages/SilverFlowerVases";

// Gifts Pages
import GiftsCollections from "./pages/GiftsCollections";
import SilverWeddingGifts from "./pages/SilverWeddingGifts";
import SilverBirthdayGifts from "./pages/SilverBirthdayGifts";
import SilverFestivalGifts from "./pages/SilverFestivalGifts";
import SilverCorporateGifts from "./pages/SilverCorporateGifts";
import SilverReturnGifts from "./pages/SilverReturnGifts";

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
import WriteReview from "./pages/WriteReview";
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
              
              {/* Mobile Categories Page */}
              <Route path="/categories" element={<MobileCategories />} />
              
              {/* Mobile Search Pages */}
              <Route path="/search" element={<MobileSearch />} />
              <Route path="/search-results" element={<SearchResults />} />
              
              {/* Jewelry Collections Main Page */}
              <Route path="/jewelry" element={<JewelryCollections />} />
              
              {/* Furniture Collections Main Page */}
              <Route path="/furniture" element={<FurnitureCollections />} />
              
              {/* Articles Collections Main Page */}
              <Route path="/articles" element={<ArticlesCollections />} />
              
              {/* Other Products Collections Main Page */}
              <Route path="/products" element={<OtherProductsCollections />} />
              
              {/* Jewellery Routes */}
              <Route path="/shop/necklaces" element={<ShopNecklaces />} />
              <Route path="/shop/rings" element={<ShopRings />} />
              <Route path="/shop/bracelets" element={<ShopBracelets />} />
              <Route path="/shop/anklets" element={<ShopAnklets />} />
              <Route path="/shop/pendants" element={<ShopPendants />} />
              <Route path="/shop/earrings" element={<ShopEarrings />} />
              
              {/* Bracelet Category Routes */}
              <Route path="/categories/bracelets/diamond" element={<DiamondBracelets />} />
              <Route path="/categories/bracelets/gemstone" element={<GemstoneBracelets />} />
              <Route path="/categories/bracelets/pearl" element={<PearlBracelets />} />
              <Route path="/categories/bracelets/gold" element={<GoldBracelets />} />
              <Route path="/categories/bracelets/silver" element={<SilverBracelets />} />
              <Route path="/categories/bracelets/bangle" element={<BangleBracelets />} />
              
              {/* Necklace Category Routes */}
              <Route path="/categories/necklaces/diamond" element={<DiamondNecklaces />} />
              <Route path="/categories/necklaces/gemstone" element={<GemstoneNecklaces />} />
              <Route path="/categories/necklaces/pearl" element={<PearlNecklaces />} />
              <Route path="/categories/necklaces/gold" element={<GoldNecklaces />} />
              <Route path="/categories/necklaces/silver" element={<SilverNecklaces />} />
              <Route path="/categories/necklaces/cross" element={<CrossNecklaces />} />
              
              {/* Ring Category Routes */}
              <Route path="/categories/rings/diamond" element={<DiamondRings />} />
              <Route path="/categories/rings/gemstone" element={<GemstoneRings />} />
              <Route path="/categories/rings/wedding" element={<WeddingRings />} />
              <Route path="/categories/rings/engagement" element={<EngagementRings />} />
              <Route path="/categories/rings/gold" element={<GoldRings />} />
              <Route path="/categories/rings/fashion" element={<FashionRings />} />
              
              {/* Jewelry Category Routes */}
              <Route path="/categories/jewelry/mens" element={<MensJewelry />} />
              <Route path="/categories/jewelry/birthstone" element={<BirthstoneJewelry />} />
              <Route path="/categories/jewelry/pearl" element={<PearlJewelry />} />
              <Route path="/categories/jewelry/rose-gold" element={<RoseGoldJewelry />} />
              <Route path="/categories/jewelry/new-arrivals" element={<NewArrivals />} />
              <Route path="/categories/jewelry/sale" element={<JewelrySale />} />
              
              {/* Furniture Routes */}
              <Route path="/furniture/silver-sofa-collection" element={<SilverSofaCollection />} />
              <Route path="/furniture/royal-silver-chairs" element={<RoyalSilverChairs />} />
              <Route path="/furniture/royal-silver-tables" element={<RoyalSilverTables />} />
              <Route path="/furniture/antique-silver-decor" element={<AntiqueSilverDecor />} />
              <Route path="/furniture/silver-swing-jhoola" element={<SilverSwingJhoola />} />
              <Route path="/furniture/silver-cradles" element={<SilverCradles />} />
              <Route path="/furniture/silver-thrones" element={<SilverThrones />} />
              
              {/* Articles Routes */}
              <Route path="/articles/pooja-items" element={<SilverPoojaItems />} />
              <Route path="/articles/gift-articles" element={<SilverGiftArticles />} />
              <Route path="/articles/silver-lamps" element={<SilverLamps />} />
              <Route path="/articles/silver-plates" element={<SilverPlates />} />
              <Route path="/articles/silver-idols" element={<SilverIdols />} />
              <Route path="/articles/silver-vessels" element={<SilverVessels />} />
              
              {/* Other Products Routes */}
              <Route path="/other-products/silver-coins" element={<SilverCoins />} />
              <Route path="/other-products/silver-bars" element={<SilverBars />} />
              <Route path="/other-products/silver-utensils" element={<SilverUtensils />} />
              <Route path="/other-products/baby-items" element={<BabyItems />} />
              <Route path="/other-products/antique-silver" element={<AntiqueSilver />} />
              <Route path="/other-products/custom-orders" element={<CustomOrders />} />
              
              {/* Home Decor Collections Main Page */}
              <Route path="/home-decor" element={<HomeDecorCollections />} />
              
              {/* Home Decor Routes */}
              <Route path="/home-decor/wall-decor" element={<SilverWallDecor />} />
              <Route path="/home-decor/photo-frames" element={<SilverPhotoFrames />} />
              <Route path="/home-decor/showpieces" element={<SilverShowpieces />} />
              <Route path="/home-decor/candle-stands" element={<SilverCandleStands />} />
              <Route path="/home-decor/flower-vases" element={<SilverFlowerVases />} />
              
              {/* Gifts Collections Main Page */}
              <Route path="/gifts" element={<GiftsCollections />} />
              
              {/* Gifts Routes */}
              <Route path="/gifts/wedding-gifts" element={<SilverWeddingGifts />} />
              <Route path="/gifts/birthday-gifts" element={<SilverBirthdayGifts />} />
              <Route path="/gifts/festival-gifts" element={<SilverFestivalGifts />} />
              <Route path="/gifts/corporate-gifts" element={<SilverCorporateGifts />} />
              <Route path="/gifts/return-gifts" element={<SilverReturnGifts />} />
              
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
