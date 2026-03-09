import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Search, Heart, ShoppingBag, User, Mic, Diamond, Gift } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo-new.png";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getAllProducts, Product } from "@/services/productService";
import { UIProduct, adaptFirebaseToUI } from "@/lib/productAdapter";
import MobileHeader from "./MobileHeader";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const { totalItems, toggleCart } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UIProduct[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allProducts, setAllProducts] = useState<UIProduct[]>([]);
  const [isListening, setIsListening] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check if current page is an auth page
  const isAuthPage = location.pathname.startsWith('/login') || 
                     location.pathname.startsWith('/signup') || 
                     location.pathname.startsWith('/forgot-password') ||
                     location.pathname.startsWith('/admin');

  // Load all products for search
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const products = await getAllProducts();
        const uiProducts = products.map(p => adaptFirebaseToUI(p as any));
        setAllProducts(uiProducts);
      } catch (error) {
        console.error('Error loading products:', error);
      }
    };
    loadProducts();
  }, []);

  // Handle click outside search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allProducts.filter(product => 
      product.title.toLowerCase().includes(query) ||
      product.category?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    ).slice(0, 8); // Limit to 8 results

    setSearchResults(filtered);
    setShowSearchResults(true);
  }, [searchQuery, allProducts]);

  // Handle scroll
  if (typeof window !== "undefined") {
    window.addEventListener("scroll", () => {
      setIsScrolled(window.scrollY > 50);
    });
  }

  // Handle voice search
  const handleVoiceSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  // Handle cancel voice search
  const handleCancelVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const navItems = [
    { name: "Contact", href: "/contact" },
  ];

  return (
    <>
      {/* Mobile Header - Only on Mobile, hidden on auth pages */}
      {!isAuthPage && <MobileHeader />}

      {/* Main Header */}
      <header
        className={`hidden lg:block sticky top-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/98 backdrop-blur-md shadow-md"
            : "bg-white"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-12 lg:px-16">
          <div className="flex items-center justify-between gap-6 h-[60px] lg:h-16">
            {/* Logo */}
            <a href="/" className="flex items-center flex-shrink-0">
              <img src={logo} alt="Sreerasthu Silvers" className="h-7 md:h-8 lg:h-9 w-auto" />
            </a>

            {/* Search Bar - Tanishq Style */}
            <div className="flex-1 max-w-[620px] mx-6" ref={searchRef}>
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute left-4">
                    <Search className="w-[19px] h-[19px] text-[#832729]" strokeWidth={1.5} />
                  </div>
                  <input
                    type="text"
                    placeholder="Search for silver jewelry, furniture and more"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery && setShowSearchResults(true)}
                    className="w-full pl-11 pr-24 py-2.5 bg-white text-sm rounded-full border border-gray-200 focus:outline-none focus:border-gray-300 transition-all placeholder:text-gray-400"
                  />
                  
                  {/* "Speak now..." overlay when listening */}
                  {isListening && (
                    <div 
                      onClick={handleCancelVoice}
                      className="absolute inset-0 bg-red-50 rounded-full flex items-center justify-center cursor-pointer"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <Mic className="w-5 h-5 text-red-500 animate-pulse" strokeWidth={2} />
                          <span className="text-sm font-medium text-red-500">Speak now...</span>
                        </div>
                        <span className="text-xs text-red-400">Tap to stop</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Gift and Mic icons on right */}
                  <div className="absolute right-3 flex items-center gap-2">
                    <button 
                      onClick={() => navigate('/articles/gift-articles')}
                      className="p-1 hover:bg-gray-50 rounded-full transition-colors" 
                      aria-label="Gift articles"
                    >
                      <Gift className="w-[19px] h-[19px] text-[#832729]" strokeWidth={1.5} />
                    </button>
                    <button 
                      onClick={handleVoiceSearch}
                      className={`p-1 hover:bg-gray-50 rounded-full transition-colors ${
                        isListening ? 'bg-red-50' : ''
                      }`}
                      aria-label="Voice search"
                    >
                      <Mic className="w-[19px] h-[19px]" strokeWidth={1.5} style={{ color: isListening ? '#EF4444' : '#832729' }} />
                    </button>
                  </div>
                </div>

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {showSearchResults && searchResults.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[400px] overflow-y-auto z-50"
                    >
                      <div className="p-2">
                        {searchResults.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              navigate(`/product/${product.id}`);
                              setSearchQuery("");
                              setShowSearchResults(false);
                            }}
                            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg w-full text-left transition-colors"
                          >
                            <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {product.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {product.category}
                              </p>
                              <p className="text-sm font-semibold text-blue-600 mt-0.5">
                                ₹{product.price.toLocaleString()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {searchResults.length === 8 && (
                        <div className="border-t border-gray-200 p-3 text-center">
                          <button
                            onClick={() => {
                              // Navigate to search results page if you have one
                              setShowSearchResults(false);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View all results for "{searchQuery}"
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* No Results Message */}
                <AnimatePresence>
                  {showSearchResults && searchQuery && searchResults.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-200 z-50"
                    >
                      <div className="p-6 text-center">
                        <p className="text-gray-600">No products found for "{searchQuery}"</p>
                        <p className="text-sm text-gray-400 mt-1">Try searching with different keywords</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Actions - Tanishq Style Icons */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Diamond Icon */}
              <button 
                onClick={() => navigate("/jewelry")}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors group"
                aria-label="Diamond jewelry"
              >
                <Diamond className="w-[21px] h-[21px] text-[#832729] group-hover:text-[#832729] transition-colors" strokeWidth={1.3} />
              </button>

              {/* Store/Gift Icon */}
              <button 
                onClick={() => navigate("/products")}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors group"
                aria-label="Store locator"
              >
                <Gift className="w-[21px] h-[21px] text-[#832729] group-hover:text-[#832729] transition-colors" strokeWidth={1.3} />
              </button>

              {/* Wishlist */}
              <button 
                onClick={() => navigate("/wishlist")}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors group relative"
                aria-label="Wishlist"
              >
                <Heart className="w-[21px] h-[21px] text-[#832729] group-hover:text-[#832729] transition-colors" strokeWidth={1.3} />
              </button>

              {/* User Profile */}
              <button 
                onClick={() => navigate(user ? "/account" : "/account")}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors group"
                aria-label="Account"
              >
                {user ? (
                  userProfile?.avatar || user.photoURL ? (
                    <img 
                      key={userProfile?.avatar || user.photoURL}
                      src={userProfile?.avatar || user.photoURL} 
                      alt="Profile" 
                      className="w-[21px] h-[21px] rounded-full object-cover border border-gray-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-[21px] h-[21px] rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-[9px]">
                        {(userProfile?.name || userProfile?.username || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )
                ) : (
                  <User className="w-[21px] h-[21px] text-[#832729] group-hover:text-[#832729] transition-colors" strokeWidth={1.3} />
                )}
              </button>

              {/* Cart with Red Badge */}
              <button 
                onClick={toggleCart}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors relative group" 
                aria-label="Cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-[21px] h-[21px] text-[#832729] group-hover:text-[#832729] transition-colors" strokeWidth={1.3} />
                  {user && totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-[#832729] text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1">
                      {totalItems}
                    </span>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Hamburger Menu - Works on All Screen Sizes */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-4 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 min-w-[180px] overflow-hidden"
            >
              <nav className="py-2">
                <a
                  href="/contact"
                  className="block px-4 py-3 text-base font-medium text-foreground hover:bg-gray-50 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Contact
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};

export default Header;
