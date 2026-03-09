import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Home, ArrowLeft, Search, X, ChevronDown, ShoppingCart, Loader2, Heart, Star, Eye, SlidersHorizontal, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { subscribeToProducts } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";

// Import placeholder images
import setImg from "@/assets/products/set-1.jpg";
import necklaceImg from "@/assets/products/necklace-1.jpg";
import ringImg from "@/assets/products/ring-1.jpg";
import earringsImg from "@/assets/products/earrings-1.jpg";
import bandImg from "@/assets/products/band-1.jpg";

const giftsCategories = [
  {
    id: 1,
    title: "Wedding Gifts",
    description: "Premium silver wedding gifts",
    image: setImg,
    href: "/gifts/wedding-gifts",
  },
  {
    id: 2,
    title: "Birthday Gifts",
    description: "Special silver birthday gifts",
    image: necklaceImg,
    href: "/gifts/birthday-gifts",
  },
  {
    id: 3,
    title: "Festival Gifts",
    description: "Festive silver gift collections",
    image: ringImg,
    href: "/gifts/festival-gifts",
  },
  {
    id: 4,
    title: "Corporate Gifts",
    description: "Elegant silver corporate gifts",
    image: earringsImg,
    href: "/gifts/corporate-gifts",
  },
  {
    id: 5,
    title: "Return Gifts",
    description: "Beautiful silver return gifts",
    image: bandImg,
    href: "/gifts/return-gifts",
  },
];

const GiftsCollections = () => {
  const navigate = useNavigate();
  const { totalItems, addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'price-low' | 'price-high'>('recent');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [activeFilterCategory, setActiveFilterCategory] = useState('Quick Filters');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);

  // Calculate min and max prices from products
  const minPrice = products.length > 0 ? Math.floor(Math.min(...products.map(p => p.price))) : 0;
  const maxPrice = products.length > 0 ? Math.ceil(Math.max(...products.map(p => p.price))) : 100000;

  // Fetch all products from Firebase and filter by gift-related categories
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToProducts(
      (fbProducts) => {
        const uiProducts = adaptFirebaseArrayToUI(fbProducts);
        // Filter only gift-related products
        const giftProducts = uiProducts.filter(product => {
          const categoryLower = (product.category || '').toLowerCase();
          return categoryLower.includes('gift') || 
                 categoryLower.includes('wedding') || 
                 categoryLower.includes('birthday') || 
                 categoryLower.includes('festival') || 
                 categoryLower.includes('corporate') ||
                 categoryLower.includes('return gift') ||
                 categoryLower.includes('present');
        });
        setProducts(giftProducts);
        setLoading(false);
      },
      true // activeOnly
    );
    return () => unsubscribe();
  }, []);

  // Initialize price range when products are loaded
  useEffect(() => {
    if (products.length > 0) {
      const min = Math.floor(Math.min(...products.map(p => p.price)));
      const max = Math.ceil(Math.max(...products.map(p => p.price)));
      setPriceRange([min, max]);
    }
  }, [products]);

  // Filter and sort products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriceRange = product.price >= priceRange[0] && product.price <= priceRange[1];
    return matchesSearch && matchesPriceRange;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return 0;
  });

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-white">
      {/* Full Page Filter Modal */}
      {showFilters && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 bg-white z-[60] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Filters</h2>
            <button
              onClick={() => setSelectedFilters([])}
              className="text-xs font-semibold text-gray-900 hover:text-gray-700 tracking-wide"
            >
              CLEAR ALL
            </button>
          </div>

          {/* Two Column Layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left - Filter Categories */}
            <div className="w-[110px] md:w-[140px] bg-gray-50 border-r border-gray-200 overflow-y-auto shrink-0">
              {[
                'Quick Filters',
                'Rating',
                'Price Range',
                'Discount',
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveFilterCategory(cat)}
                  className={`w-full text-left px-3 py-3.5 text-xs font-medium border-b border-gray-100 ${
                    activeFilterCategory === cat
                      ? 'bg-white text-gray-900 border-l-[3px] border-l-gray-900'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Right - Filter Options */}
            <div className="flex-1 overflow-y-auto">
              {activeFilterCategory === 'Quick Filters' && (
                <div className="py-1">
                  {[
                    { 
                      id: 'top-rated', 
                      label: 'Top Rated', 
                      count: products.filter(p => (p.rating || 0) >= 4.0).length.toString() 
                    },
                    { 
                      id: 'best-sellers', 
                      label: 'Best Sellers', 
                      count: products.filter(p => (p.reviews || 0) > 50).length.toString() 
                    },
                    { 
                      id: 'trend-products', 
                      label: 'Trend Products', 
                      count: products.length.toString() 
                    },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setSelectedFilters(prev =>
                          prev.includes(filter.id)
                            ? prev.filter(f => f !== filter.id)
                            : [...prev, filter.id]
                        );
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Check className={`w-4 h-4 ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900'
                            : 'text-gray-300'
                        }`} />
                        <span className={`text-sm ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-700'
                        }`}>{filter.label}</span>
                      </div>
                      <span className="text-xs text-gray-400">{filter.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {activeFilterCategory === 'Rating' && (
                <div className="py-1">
                  {[
                    { id: 'rating-1', label: '1.0 to 5.0', count: products.filter(p => (p.rating || 0) >= 1.0).length.toString() },
                    { id: 'rating-2', label: '2.0 to 5.0', count: products.filter(p => (p.rating || 0) >= 2.0).length.toString() },
                    { id: 'rating-3', label: '3.0 to 5.0', count: products.filter(p => (p.rating || 0) >= 3.0).length.toString() },
                    { id: 'rating-4', label: '4.0 to 5.0', count: products.filter(p => (p.rating || 0) >= 4.0).length.toString() },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setSelectedFilters(prev =>
                          prev.includes(filter.id)
                            ? prev.filter(f => f !== filter.id)
                            : [...prev, filter.id]
                        );
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Check className={`w-4 h-4 ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900'
                            : 'text-gray-300'
                        }`} />
                        <span className={`text-sm ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-700'
                        }`}>{filter.label}</span>
                      </div>
                      <span className="text-xs text-gray-400">{filter.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {activeFilterCategory === 'Discount' && (
                <div className="py-1">
                  {[
                    { id: 'discount-10', label: '10% and above', count: products.filter(p => Number(p.discount || 0) >= 10).length.toString() },
                    { id: 'discount-20', label: '20% and above', count: products.filter(p => Number(p.discount || 0) >= 20).length.toString() },
                    { id: 'discount-30', label: '30% and above', count: products.filter(p => Number(p.discount || 0) >= 30).length.toString() },
                    { id: 'discount-40', label: '40% and above', count: products.filter(p => Number(p.discount || 0) >= 40).length.toString() },
                    { id: 'discount-50', label: '50% and above', count: products.filter(p => Number(p.discount || 0) >= 50).length.toString() },
                    { id: 'discount-60', label: '60% and above', count: products.filter(p => Number(p.discount || 0) >= 60).length.toString() },
                    { id: 'discount-70', label: '70% and above', count: products.filter(p => Number(p.discount || 0) >= 70).length.toString() },
                    { id: 'discount-80', label: '80% and above', count: products.filter(p => Number(p.discount || 0) >= 80).length.toString() },
                    { id: 'discount-90', label: '90% and above', count: products.filter(p => Number(p.discount || 0) >= 90).length.toString() },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        setSelectedFilters(prev =>
                          prev.includes(filter.id)
                            ? prev.filter(f => f !== filter.id)
                            : [...prev, filter.id]
                        );
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Check className={`w-4 h-4 ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900'
                            : 'text-gray-300'
                        }`} />
                        <span className={`text-sm ${
                          selectedFilters.includes(filter.id)
                            ? 'text-gray-900 font-medium'
                            : 'text-gray-700'
                        }`}>{filter.label}</span>
                      </div>
                      <span className="text-xs text-gray-400">{filter.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {activeFilterCategory === 'Price Range' && (
                <div className="px-4 py-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Selected Price range</h3>
                    <p className="text-base font-semibold text-gray-900">
                      ₹{priceRange[0].toLocaleString('en-IN')} - ₹{priceRange[1].toLocaleString('en-IN')}+
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <div className="relative h-2 mt-8 mb-8">
                      {/* Background track */}
                      <div className="absolute w-full h-2 bg-gray-200 rounded-lg"></div>
                      
                      {/* Active range bar */}
                      <div 
                        className="absolute h-2 bg-gray-900 rounded-lg"
                        style={{
                          left: `${((priceRange[0] - minPrice) / (maxPrice - minPrice)) * 100}%`,
                          right: `${100 - ((priceRange[1] - minPrice) / (maxPrice - minPrice)) * 100}%`
                        }}
                      ></div>
                      
                      {/* Min range slider */}
                      <input
                        type="range"
                        min={minPrice}
                        max={maxPrice}
                        value={priceRange[0]}
                        onChange={(e) => {
                          const newMin = Number(e.target.value);
                          if (newMin <= priceRange[1]) {
                            setPriceRange([newMin, priceRange[1]]);
                          }
                        }}
                        className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer"
                        style={{ zIndex: priceRange[1] - priceRange[0] < (maxPrice - minPrice) * 0.05 ? 3 : 5 }}
                      />
                      
                      {/* Max range slider */}
                      <input
                        type="range"
                        min={minPrice}
                        max={maxPrice}
                        value={priceRange[1]}
                        onChange={(e) => {
                          const newMax = Number(e.target.value);
                          if (newMax >= priceRange[0]) {
                            setPriceRange([priceRange[0], newMax]);
                          }
                        }}
                        className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer"
                        style={{ zIndex: priceRange[1] - priceRange[0] < (maxPrice - minPrice) * 0.05 ? 5 : 4 }}
                      />
                    </div>
                  </div>

                  <div className="text-sm text-gray-500 mt-8">
                    {products.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]).length} Products found
                  </div>
                </div>
              )}
              {activeFilterCategory !== 'Quick Filters' && activeFilterCategory !== 'Rating' && activeFilterCategory !== 'Discount' && activeFilterCategory !== 'Price Range' && (
                <div className="flex items-center justify-center h-full text-sm text-gray-400">
                  No options available
                </div>
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="border-t border-gray-200 px-4 py-3 flex gap-3">
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 py-3 text-sm font-semibold text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
            >
              CLOSE
            </button>
            <button
              onClick={() => {
                setShowFilters(false);
              }}
              className="flex-1 py-3 text-sm font-semibold text-white bg-gray-900 rounded hover:bg-gray-800"
            >
              APPLY
            </button>
          </div>
        </motion.div>
      )}

      <div className="hidden md:block">
        <Header />
      </div>
      
      <main>
        {/* Mobile Header with Search and Cart */}
        <div className="md:hidden sticky top-0 z-50 bg-white border-b border-gray-200">
          {showSearch ? (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search gifts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <h1 className="text-lg font-semibold text-gray-900">Gifts Collections</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSearch(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Search className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => navigate('/cart')}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors relative"
                >
                  <ShoppingCart className="w-5 h-5 text-gray-700" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Sort Bar */}
          {!showSearch && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowFilters(true)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-gray-700" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="flex items-center gap-1 text-xs text-gray-700 hover:text-gray-900"
                    >
                      Sort by
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSortDropdown && (
                      <>
                        <div
                          className="fixed inset-0 bg-black/20 z-40"
                          onClick={() => setShowSortDropdown(false)}
                        />
                        <motion.div
                          initial={{ y: "100%" }}
                          animate={{ y: 0 }}
                          exit={{ y: "100%" }}
                          transition={{ type: "spring", damping: 30, stiffness: 300 }}
                          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 md:absolute md:right-0 md:left-auto md:top-full md:bottom-auto md:mt-1 md:rounded-lg md:min-w-[160px]"
                        >
                          <div className="md:hidden w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />
                          <div className="py-4 md:py-1">
                            <div className="px-4 pb-2 md:hidden">
                              <h3 className="text-sm font-semibold text-gray-900">Sort by</h3>
                            </div>
                            <button
                              onClick={() => {
                                setSortBy('recent');
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 md:py-2 text-sm md:text-xs hover:bg-gray-50 ${
                                sortBy === 'recent' ? 'text-orange-600 font-medium bg-orange-50' : 'text-gray-700'
                              }`}
                            >
                              Most Recent
                            </button>
                            <button
                              onClick={() => {
                                setSortBy('price-low');
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 md:py-2 text-sm md:text-xs hover:bg-gray-50 ${
                                sortBy === 'price-low' ? 'text-orange-600 font-medium bg-orange-50' : 'text-gray-700'
                              }`}
                            >
                              Price: Low to High
                            </button>
                            <button
                              onClick={() => {
                                setSortBy('price-high');
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-3 md:py-2 text-sm md:text-xs hover:bg-gray-50 ${
                                sortBy === 'price-high' ? 'text-orange-600 font-medium bg-orange-50' : 'text-gray-700'
                              }`}
                            >
                              Price: High to Low
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Back Button and Title */}
        <div className="hidden md:block">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="bg-gray-50 border-b border-gray-200 hidden md:block">
          <div className="container-custom py-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <span>/</span>
              <span className="text-foreground font-medium">Gifts Collections</span>
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <section className="py-4 md:py-20 bg-white">
          <div className="container-custom">
            {/* Mobile: Horizontal Scroll */}
            <div className="md:hidden flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide">
              {giftsCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.1,
                    ease: "easeOut"
                  }}
                  className="flex-shrink-0"
                >
                  <Link 
                    to={category.href}
                    className="group block"
                  >
                    <div className="relative overflow-hidden flex flex-col items-center">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mb-2 relative">
                        <img
                          src={category.image}
                          alt={category.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="text-center max-w-[96px]">
                        <h3 
                          className="text-sm font-serif font-light text-foreground"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {category.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
            
            {/* Desktop: Grid */}
            <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
              {giftsCategories.map((category, index) => (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: index * 0.1,
                    ease: "easeOut"
                  }}
                >
                  <Link 
                    to={category.href}
                    className="group block"
                  >
                    <div className="relative overflow-hidden flex flex-col items-center">
                      <div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden bg-gray-100 mb-6 relative">
                        <img
                          src={category.image}
                          alt={category.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-8">
                          <span className="text-white font-medium flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                            Explore Collection
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      <div className="text-center">
                        <h3 
                          className="text-2xl md:text-3xl font-serif font-light text-foreground mb-2 group-hover:text-primary transition-colors duration-300"
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {category.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Decorative Divider - Hidden on Mobile */}
        <section className="hidden md:block py-12 bg-gray-50">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="py-8"
              >
                <p className="text-sm uppercase tracking-widest text-primary mb-4">Crafted with Precision</p>
                <h2 
                  className="text-3xl md:text-4xl font-serif font-light text-foreground mb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  The Perfect Silver Gift for Every Occasion
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Discover our curated collection of premium silver gifts, 
                  perfect for weddings, birthdays, festivals, and corporate events.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* All Products Grid */}
        <section className="py-4 bg-white">
          <div className="container-custom px-4">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-gray-200 aspect-[3/4] rounded-lg mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-8 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No gift items found</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs text-orange-600 hover:text-orange-700"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                {sortedProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div 
                      className="relative aspect-square bg-gray-100 cursor-pointer group"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Wishlist Icon - Top Left */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isInWishlist(product.id)) {
                            removeFromWishlist(product.id);
                          } else {
                            addToWishlist(product.id);
                          }
                        }}
                        className="absolute top-2 left-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors z-10"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                        />
                      </button>

                      {/* Discount Badge - Top Right */}
                      {Number(product.discount) > 0 && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm">
                          {product.discount}% OFF
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      {/* Cart Icon and Rating */}
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              id: product.id,
                              name: product.title,
                              price: product.price,
                              image: product.image,
                              category: product.category,
                            });
                            toast({
                              title: "Added to cart",
                              description: `${product.title} has been added to your cart.`,
                            });
                          }}
                          className="p-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                        
                        {/* Rating */}
                        <div className="flex items-center gap-0.5 bg-green-600 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          {product.rating || 4.5}
                          <Star className="w-2.5 h-2.5 fill-white" />
                          {product.reviews ? ` (${product.reviews})` : ''}
                        </div>
                      </div>

                      {/* Product Name */}
                      <h3 className="text-xs font-medium text-gray-900 truncate mb-1">
                        {product.title}
                      </h3>

                      {/* Price */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="text-sm font-bold text-gray-900">
                          ₹{product.price.toLocaleString('en-IN')}
                        </p>
                        {product.oldPrice && (
                          <p className="text-[10px] text-gray-400 line-through">
                            ₹{product.oldPrice.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart({
                            id: product.id,
                            name: product.title,
                            price: product.price,
                            image: product.image,
                            category: product.category,
                          });
                          toast({
                            title: "Added to cart",
                            description: `${product.title} has been added to your cart.`,
                          });
                        }}
                        className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        ADD TO CART
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
};

export default GiftsCollections;
