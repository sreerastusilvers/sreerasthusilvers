import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Heart, ShoppingBag, Check, X, Package } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { subscribeToProductsBySubcategory } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import { Slider } from "@/components/ui/slider";

type SortOption = 'default' | 'price-low-high' | 'price-high-low' | 'newest' | 'best-rating';

interface CartItem {
  product: UIProduct;
  quantity: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  productTitle?: string;
}

const BirthstoneJewelry = () => {
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    console.log('BirthstoneJewelry: Setting up real-time listener...');
    setLoading(true);
    
    const unsubscribe = subscribeToProductsBySubcategory('Jewelry', (fbProducts) => {
      const uiProducts = adaptFirebaseArrayToUI(fbProducts);
      const birthstoneJewelry = uiProducts.filter(product => 
        product.title.toLowerCase().includes('birthstone')
      );
      setProducts(birthstoneJewelry);
      
      if (birthstoneJewelry.length > 0) {
        const prices = birthstoneJewelry.map(p => p.price);
        const minPrice = Math.floor(Math.min(...prices));
        const maxPrice = Math.ceil(Math.max(...prices));
        setPriceRange([minPrice, maxPrice]);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info', productTitle?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, productTitle }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { minPrice, maxPrice } = useMemo(() => {
    if (products.length === 0) return { minPrice: 0, maxPrice: 100000 };
    const prices = products.map(p => p.price);
    return {
      minPrice: Math.floor(Math.min(...prices)),
      maxPrice: Math.ceil(Math.max(...prices))
    };
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(product => {
      const category = product.category || 'Uncategorized';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const priceInRange = product.price >= priceRange[0] && product.price <= priceRange[1];
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(product.category);
      return priceInRange && categoryMatch;
    });
  }, [products, priceRange, selectedCategories]);

  const sortedProducts = useMemo(() => {
    const productsList = [...filteredProducts];
    switch (sortBy) {
      case 'price-low-high': return productsList.sort((a, b) => a.price - b.price);
      case 'price-high-low': return productsList.sort((a, b) => b.price - a.price);
      case 'newest': return productsList.sort((a, b) => b.id.localeCompare(a.id));
      case 'best-rating': return productsList.sort((a, b) => b.rating !== a.rating ? b.rating - a.rating : b.reviews - a.reviews);
      default: return productsList;
    }
  }, [sortBy, filteredProducts]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleProductClick = (productId: string) => navigate(`/product/${productId}`);

  const toggleWishlist = (productId: string, productTitle: string) => {
    setWishlist((prev) => {
      const isInWishlist = prev.includes(productId);
      showToast(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist', isInWishlist ? 'info' : 'success', productTitle);
      return isInWishlist ? prev.filter((id) => id !== productId) : [...prev, productId];
    });
  };

  const addToCart = (product: UIProduct) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id);
      if (existingItem) {
        showToast('Quantity updated in cart', 'success', product.title);
        return prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        showToast('Added to cart', 'success', product.title);
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  return (
    <div className="min-h-screen w-full overflow-x-clip">
      <Header />
      <main>
        <section className="relative h-[200px] md:h-[300px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60 z-10" />
            <img 
              src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1600&q=80" 
              alt="Birthstone Jewelry"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="relative z-20 text-center px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
                Birthstone Jewelry
              </h1>
              <div className="flex items-center justify-center gap-2 text-sm md:text-base text-white/90">
                <a href="/" className="hover:text-white transition-colors">HOME PAGE</a>
                <span>{'>'}</span>
                <span className="text-white font-medium">BIRTHSTONE JEWELRY</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-8 md:py-10">
          <div className="container-custom">
            <div className="flex flex-col lg:flex-row gap-8">
              <aside className="lg:w-64 flex-shrink-0">
                <div className="space-y-6">
                  <div className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold text-base mb-4">Categories</h3>
                    <div className="space-y-2">
                      {Object.entries(categoryCounts).map(([category, count]) => (
                        <label key={category} className="flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(category)}
                              onChange={() => toggleCategory(category)}
                              className="rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm group-hover:text-primary transition-colors">{category}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">({count})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-2">
                    <h3 className="font-['Poppins'] font-semibold text-base mb-4">Price Filter</h3>
                    <div className="space-y-4">
                      <div className="pt-2 pb-4">
                        <Slider
                          min={minPrice}
                          max={maxPrice}
                          step={100}
                          value={priceRange}
                          onValueChange={(value) => setPriceRange(value as [number, number])}
                          className="w-full"
                          minStepsBetweenThumbs={1}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">₹{priceRange[0].toLocaleString('en-IN')}</span>
                        <span className="text-muted-foreground">₹{priceRange[1].toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-sm text-muted-foreground">Showing <span className="text-foreground font-medium">{sortedProducts.length}</span> results</p>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="px-4 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                    <option value="default">Default Sorting</option>
                    <option value="price-low-high">Price: Low to High</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="newest">Newest First</option>
                    <option value="best-rating">Best Rating</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="animate-pulse">
                    <div className="bg-muted rounded-xl aspect-square mb-4"></div>
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                ))
              ) : sortedProducts.length === 0 ? (
                <div className="col-span-full py-16 text-center">
                  <Package className="w-20 h-20 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No Birthstone Jewelry Available</h3>
                  <p className="text-muted-foreground">Check back soon for new products!</p>
                </div>
              ) : (
                sortedProducts.map((product, index) => (
                <motion.div key={product.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05 }} className="group cursor-pointer" onClick={() => handleProductClick(product.id)}>
                  <div className="relative bg-muted rounded-xl overflow-hidden aspect-square mb-4">
                    <img src={product.image} alt={product.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute top-3 right-3 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300">
                      <motion.button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id, product.title); }} whileTap={{ scale: 0.9 }} className={`p-2 rounded-full transition-all duration-300 ${wishlist.includes(product.id) ? "text-red-500" : "text-white/90 hover:text-red-500"}`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                        <Heart className="w-5 h-5" fill={wishlist.includes(product.id) ? "currentColor" : "none"} strokeWidth={2} />
                      </motion.button>
                    </div>
                    <div className="hidden md:block absolute bottom-3 left-3 right-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <motion.button onClick={(e) => { e.stopPropagation(); addToCart(product); }} whileTap={{ scale: 0.95 }} className="w-full py-2.5 bg-white/20 backdrop-blur-sm text-white border border-white/40 rounded-full hover:bg-white/30 transition-all flex items-center justify-center gap-2 text-sm font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                        <ShoppingBag className="w-4 h-4" />
                        Add to Cart
                      </motion.button>
                    </div>
                    {product.oldPrice && <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded">SALE</div>}
                  </div>
                  <div className="space-y-2 text-center">
                    <span className="text-xs uppercase tracking-wider text-primary font-medium">{product.category}</span>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors text-sm md:text-base" style={{ fontFamily: "'Poppins', sans-serif" }}>{product.title}</h3>
                    <div className="flex items-center justify-center gap-0.5 md:gap-1">
                      {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 md:w-3.5 md:h-3.5 ${i < product.rating ? "fill-primary text-primary" : "fill-muted text-muted-foreground"}`} />)}
                      <span className="text-[10px] md:text-xs text-muted-foreground ml-0.5 md:ml-1">({product.reviews})</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-semibold text-foreground">₹{product.price.toLocaleString('en-IN')}</span>
                      {product.oldPrice && <span className="text-sm text-muted-foreground line-through">₹{product.oldPrice.toLocaleString('en-IN')}</span>}
                    </div>
                    <motion.button onClick={(e) => { e.stopPropagation(); addToCart(product); }} whileTap={{ scale: 0.95 }} className="md:hidden w-full py-2 mt-2 bg-primary/10 text-primary border border-primary/30 rounded-full hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-2 text-xs font-medium">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      Add to Cart
                    </motion.button>
                  </div>
                </motion.div>
              )))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3">
            {toasts.map((toast) => (
              <motion.div key={toast.id} initial={{ opacity: 0, x: 100, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 100, scale: 0.9 }} transition={{ type: "spring", damping: 20, stiffness: 300 }} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[280px] ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-blue-50 border border-blue-200 text-blue-800'}`}>
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
                  {toast.type === 'success' ? <Check className="w-4 h-4 text-white" /> : toast.type === 'error' ? <X className="w-4 h-4 text-white" /> : <Heart className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{toast.message}</p>
                  {toast.productTitle && <p className="text-xs opacity-75 truncate max-w-[200px]">{toast.productTitle}</p>}
                </div>
                <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 p-1 hover:bg-black/10 rounded transition-colors"><X className="w-4 h-4" /></button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BirthstoneJewelry;
