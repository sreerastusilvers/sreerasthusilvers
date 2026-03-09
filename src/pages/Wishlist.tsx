import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingBag, Trash2, ArrowLeft, Package, Search, SlidersHorizontal, Plus, Minus, ChevronRight, SquarePen, MapPin, ShieldCheck, CreditCard, MessageCircle, LogOut } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileHeader from "@/components/MobileHeader";
import MobileSearchBar from "@/components/MobileSearchBar";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { getProduct } from "@/services/productService";
import { UIProduct, adaptFirebaseToUI } from "@/lib/productAdapter";
import { useAuth } from "@/contexts/AuthContext";

const Wishlist = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { wishlist, removeFromWishlist, isLoaded } = useWishlist();
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountExpanded, setAccountExpanded] = useState(() => {
    // Initialize from sessionStorage to persist across back navigation
    const saved = sessionStorage.getItem('accountDropdownExpanded');
    return saved === 'true';
  });

  // Save dropdown state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('accountDropdownExpanded', String(accountExpanded));
  }, [accountExpanded]);

  useEffect(() => {
    const loadWishlistProducts = async () => {
      if (!isLoaded) return;
      
      setLoading(true);
      try {
        const productPromises = wishlist.map(id => getProduct(id));
        const fbProducts = await Promise.all(productPromises);
        const validProducts = fbProducts.filter(p => p !== null);
        const uiProducts = validProducts.map(p => adaptFirebaseToUI(p!));
        setProducts(uiProducts);
      } catch (error) {
        console.error('Error loading wishlist products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWishlistProducts();
  }, [wishlist, isLoaded]);

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const handleRemove = (productId: string, productTitle: string) => {
    removeFromWishlist(productId, productTitle);
  };

  // Advanced search filter - searches across multiple fields
  const filteredProducts = products.filter(product => {
    if (!searchQuery || searchQuery.trim() === '') return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Search in title
    if (product.title.toLowerCase().includes(query)) return true;
    
    // Search in category
    if (product.category && product.category.toLowerCase().includes(query)) return true;
    
    // Search in price (if user types numbers)
    if (product.price.toString().includes(query)) return true;
    
    // Search in old price
    if (product.oldPrice && product.oldPrice.toString().includes(query)) return true;
    
    return false;
  });

  if (loading || !isLoaded) {
    return (
      <>
        <div className="hidden lg:block">
          <Header />
        </div>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
        <div className="hidden lg:block">
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        <Header />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen"
        >
          {/* Hero Banner Section */}
          <section className="relative h-[200px] md:h-[280px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60 z-10" />
              <img 
                src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1600&q=80" 
                alt="My Wishlist"
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="relative z-20 container mx-auto px-4 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="mb-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    My Wishlist
                  </h1>
                </div>
                <p className="text-white/90 text-lg md:text-xl mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {products.length} {products.length === 1 ? 'item' : 'items'} saved for later
                </p>
                
                {/* Breadcrumb */}
                <div className="text-sm text-white/80 flex items-center justify-center gap-2">
                  <button onClick={() => navigate("/")} className="hover:text-white transition-colors">
                    Home
                  </button>
                  <span>/</span>
                  <span className="text-white">Wishlist</span>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Content */}
          <div className="container mx-auto px-4 py-8 sm:py-12 bg-background">
            {!user ? (
              /* Not Logged In */
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 px-4"
              >
                <div className="w-32 h-32 bg-gradient-to-br from-red-50 to-pink-50 rounded-full flex items-center justify-center mb-6">
                  <Heart className="w-16 h-16 text-red-300" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Login to View Wishlist</h2>
                <p className="text-gray-500 text-center mb-8 max-w-md">
                  Sign in to access your saved items and manage your wishlist.
                </p>
                <Button
                  onClick={() => navigate('/login')}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-6 text-base rounded-lg"
                >
                  Login / Sign Up
                </Button>
              </motion.div>
            ) : products.length === 0 ? (
              // Empty State
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-12 sm:py-20"
              >
                <div className="relative mb-8">
                  <div className="w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-40 h-40 sm:w-52 sm:h-52 border-8 border-foreground/80 rounded-lg relative bg-background">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-12 sm:h-16 border-8 border-foreground/80 border-b-0 rounded-t-lg bg-background"></div>
                        <div className="absolute top-1/2 left-0 right-0 h-4 bg-foreground/20 -translate-y-1/2"></div>
                        <div className="absolute top-0 bottom-0 left-1/2 w-4 bg-foreground/20 -translate-x-1/2"></div>
                      </div>
                      <div className="absolute -right-12 bottom-4 w-10 h-10 border-4 border-foreground/60 rounded bg-background rotate-12"></div>
                      <div className="absolute -right-8 bottom-0 w-8 h-8 border-4 border-foreground/60 rounded bg-background -rotate-6"></div>
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  My Wishlist is Empty!
                </h2>
                <p className="text-muted-foreground text-center mb-8 max-w-md">
                  {user 
                    ? "Feels heavy to even start adding your favorite items!"
                    : "Please login to start adding your favorite items to wishlist"
                  }
                </p>
                <div className="flex gap-4">
                  {!user && (
                    <Button
                      onClick={() => navigate("/auth/login")}
                      size="lg"
                      className="gap-2"
                    >
                      Login to Continue
                    </Button>
                  )}
                  <Button
                    onClick={() => navigate("/")}
                    variant={user ? "default" : "outline"}
                    size="lg"
                    className="gap-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Start Shopping
                  </Button>
                </div>
              </motion.div>
            ) : (
              // Product Grid
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                  {products.map((product, index) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="group bg-card rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 border border-border"
                    >
                      <div
                        className="relative aspect-square overflow-hidden cursor-pointer bg-muted"
                        onClick={() => handleProductClick(product.id)}
                      >
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.title}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-muted">
                            <ShoppingBag className="w-16 h-16 text-muted-foreground/30" />
                          </div>
                        )}
                        
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemove(product.id, product.title);
                            }}
                            className="rounded-full shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {product.oldPrice && product.oldPrice > product.price && (
                          <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-semibold shadow-lg">
                            {Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}% OFF
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="space-y-1">
                          <h3
                            className="font-normal text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleProductClick(product.id)}
                          >
                            {product.title}
                          </h3>
                          {product.category && (
                            <p className="text-sm text-muted-foreground">
                              {product.category}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-normal text-primary">
                                ₹{product.price.toLocaleString()}
                              </span>
                              {product.oldPrice && product.oldPrice > product.price && (
                                <span className="text-sm text-muted-foreground line-through">
                                  ₹{product.oldPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => handleRemove(product.id, product.title)}
                            className="rounded-full"
                          >
                            <Heart className="w-4 h-4" fill="currentColor" />
                          </Button>
                        </div>

                        <Button
                          onClick={() => handleProductClick(product.id)}
                          className="w-full gap-2"
                          variant="outline"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          View Details
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
        <Footer />
      </div>

      {/* Mobile View */}
      <div className="lg:hidden min-h-screen bg-white pb-20">
        {/* Tanishq-style Header + Search */}
        <MobileHeader />
        <MobileSearchBar />

        {/* Breadcrumb */}
        <div className="px-4 py-4 flex items-center gap-1 text-sm flex-wrap">
          <button onClick={() => navigate("/")} className="text-gray-900 font-medium hover:underline">Home</button>
          <span className="text-gray-400">|</span>
          <button onClick={() => navigate("/account")} className="text-gray-900 font-medium hover:underline">My Account</button>
          <span className="text-gray-400">|</span>
          <span className="text-gray-400 text-xs">Wishlist</span>
        </div>

        {/* My Account Expandable Section */}
        {user && (
          <div className="mx-4 mb-4">
          <button
            onClick={() => setAccountExpanded(!accountExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 border border-gray-200 rounded-md bg-white"
          >
            <span className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              My Account
            </span>
            {accountExpanded ? (
              <Minus className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            ) : (
              <Plus className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
            )}
          </button>
          
          <AnimatePresence>
            {accountExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border border-t-0 border-gray-200 rounded-b-md"
              >
                {/* Quick tabs */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                  {[
                    { label: "Orders", path: "/account/orders" },
                    { label: "Buy Again", path: "/buy-again" },
                    { label: "Lists", path: "/wishlist" },
                  ].map((tab) => (
                    <button
                      key={tab.label}
                      onClick={() => {
                        // If clicking "Lists" while already on wishlist, just toggle the dropdown
                        if (tab.path === "/wishlist") {
                          setAccountExpanded(false);
                        } else {
                          navigate(tab.path);
                        }
                      }}
                      className="px-4 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Menu items */}
                <div className="py-1">
                  {[
                    { label: "Edit Profile", icon: SquarePen, path: "/account/profile-edit" },
                    { label: "Your addresses", icon: MapPin, path: "/account/addresses" },
                    { label: "Login & security", icon: ShieldCheck, path: "/security" },
                    { label: "My Jewellery Journey", icon: CreditCard, path: "/wallet" },
                    { label: "Customer support", icon: MessageCircle, path: "/customer-support" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="w-full text-left px-5 py-3.5 text-sm flex items-center gap-3 text-gray-800 hover:bg-gray-50 transition-colors"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      <item.icon className="w-5 h-5 text-gray-600" strokeWidth={1.5} />
                      {item.label}
                    </button>
                  ))}

                  {/* Log out */}
                  {user && (
                    <button
                      onClick={async () => {
                        sessionStorage.removeItem('accountDropdownExpanded');
                        await logout();
                        navigate('/');
                      }}
                      className="w-full text-left px-5 py-3.5 text-sm flex items-center gap-3 text-[#832729] hover:bg-gray-50 transition-colors border-t border-gray-100"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      <LogOut className="w-5 h-5 text-[#832729]" strokeWidth={1.5} />
                      Log out
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Customer Service Info Box */}
        {user && (
          <div className="mx-4 mb-6 bg-gray-100 rounded-md px-5 py-4">
          <p className="text-xs text-gray-600 text-center leading-relaxed" style={{ fontFamily: "'Poppins', sans-serif" }}>
            If you have any questions or issues with an order,<br />
            please contact our Customer Service team at sreerasthusilvers@gmail.com
            or by calling the free number <span className="font-bold text-gray-900">+91 6304960489</span>.<br />
            This toll free number is not applicable for<br />
            International shipments.
          </p>
        </div>
        )}

        {/* Wishlist Section Title */}
        <div className="px-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Wishlist
          </h2>
        </div>

        {/* Content */}
        <div className="px-4 pb-4">
          {!user ? (
            /* Not Logged In State */
            <div className="flex flex-col items-center justify-center py-10">
              {/* Heart Icon */}
              <div className="mb-6">
                <Heart className="w-16 h-16 text-pink-200" fill="#FBCFE8" strokeWidth={1} />
              </div>
              
              {/* Box illustration */}
              <div className="relative mb-8">
                <div className="w-48 h-40 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-3 bg-gray-300 rounded mx-auto mb-2" />
                    <div className="w-12 h-3 bg-gray-300 rounded mx-auto mb-4" />
                    <div className="flex justify-center gap-1">
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-400" />
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm text-center mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Please login to view your wishlist
              </p>
              <Button
                onClick={() => navigate("/login")}
                size="sm"
                className="gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
              >
                Login / Sign Up
              </Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            // Empty State - Tanishq Style
            <div className="flex flex-col items-center justify-center py-10">
              {/* Heart Icon */}
              <div className="mb-6">
                <Heart className="w-16 h-16 text-pink-200" fill="#FBCFE8" strokeWidth={1} />
              </div>
              
              {/* Box illustration */}
              <div className="relative mb-8">
                <div className="w-48 h-40 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-3 bg-gray-300 rounded mx-auto mb-2" />
                    <div className="w-12 h-3 bg-gray-300 rounded mx-auto mb-4" />
                    <div className="flex justify-center gap-1">
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-400" />
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-500 text-sm text-center mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Your wishlist is empty. Start adding items you love!
              </p>
              <Button
                onClick={() => navigate("/")}
                size="sm"
                className="gap-2 bg-[#832729] hover:bg-[#6a1f21] text-white rounded-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Start Shopping
              </Button>
            </div>
          ) : (
            // Product Grid - 2 columns
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white rounded-lg overflow-hidden border border-gray-100 shadow-sm"
                  >
                    {/* Product Image */}
                    <div
                      className="relative aspect-square overflow-hidden cursor-pointer bg-gray-50"
                      onClick={() => handleProductClick(product.id)}
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      
                      {/* Heart Icon - Top Right */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(product.id, product.title);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-sm"
                      >
                        <Heart className="w-4 h-4 text-red-500" fill="currentColor" />
                      </button>

                      {product.oldPrice && product.oldPrice > product.price && (
                        <div className="absolute top-2 left-2 bg-[#832729] text-white px-2 py-0.5 rounded text-[10px] font-semibold">
                          {Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}% OFF
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3">
                      <h3
                        className="text-xs font-normal text-gray-900 mb-1 line-clamp-2 leading-relaxed"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                        onClick={() => handleProductClick(product.id)}
                      >
                        {product.title}
                      </h3>
                      
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span className="text-sm font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          ₹{product.price.toLocaleString('en-IN')}
                        </span>
                        {product.oldPrice && product.oldPrice > product.price && (
                          <span className="text-[10px] text-gray-400 line-through">
                            ₹{product.oldPrice.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(product.id);
                        }}
                        className="w-full py-2 px-3 bg-[#832729] rounded text-xs font-medium text-white flex items-center justify-center gap-1.5 hover:bg-[#6a1f21] transition-colors"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Wishlist;