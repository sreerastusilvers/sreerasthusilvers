import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Heart, ShoppingCart } from "lucide-react";
import { subscribeToTopDeals } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";
import useAutoScroll from "@/hooks/useAutoScroll";

const TopDeals = () => {
  const navigate = useNavigate();
  const { addToCart, openCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const {
    scrollerRef: mobileScrollRef,
    scrollByPage: mobileScrollByPage,
    canScroll: canMobileDealsScroll,
  } = useAutoScroll({ speed: 0.5, resumeDelay: 2400, loop: true, direction: 1, loopItemCount: products.length });

  const mobileDealProducts =
    canMobileDealsScroll && products.length > 1 ? [...products, ...products] : products;

  useEffect(() => {
    const unsubscribe = subscribeToTopDeals((fbProducts) => {
      const uiProducts = adaptFirebaseArrayToUI(fbProducts);
      setProducts(uiProducts);
      setLoading(false);
    }, 10);

    return () => unsubscribe();
  }, []);

  const handleAddToCart = async (e: React.MouseEvent, product: UIProduct) => {
    e.stopPropagation();
    
    try {
      await addToCart({
        id: product.id,
        name: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
      });
      openCart();
      
      toast({
        title: "Added to cart",
        description: `${product.title} has been added to your cart.`,
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWishlistClick = (e: React.MouseEvent, productId: string, productTitle: string) => {
    e.stopPropagation();
    toggleWishlist(productId, productTitle);
  };

  if (loading) {
    return null;
  }

  if (products.length === 0) return null;

  // Desktop: featured product on left, rest on right with pagination
  const featuredProduct = products[0];
  const restProducts = products.slice(1);
  const productsPerPage = 4;
  const totalPages = Math.max(1, Math.ceil(restProducts.length / productsPerPage));
  const visibleProducts = restProducts.slice(
    currentPage * productsPerPage,
    (currentPage + 1) * productsPerPage
  );

  const nextPage = () => setCurrentPage((prev) => (prev + 1) % totalPages);
  const prevPage = () => setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);

  return (
    <section className="py-6 md:py-14">
      <div className="container-custom">
        <div className="rounded-[32px] border border-[#d4af37]/15 bg-[linear-gradient(180deg,rgba(212,175,55,0.08)_0%,rgba(255,255,255,0)_22%),linear-gradient(135deg,rgba(131,39,41,0.04)_0%,rgba(255,255,255,0)_45%)] bg-card/70 shadow-[0_30px_70px_-55px_rgba(0,0,0,0.4)] px-3 py-4 md:px-6 md:py-8">

        {/* ====== MOBILE: Horizontal scroll cards ====== */}
        <div className="md:hidden">
          <div className="mb-4 px-1">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-px w-6 bg-primary/50" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-medium">Top Deals</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Signature savings
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Scroll deals left"
                  onClick={() => mobileScrollByPage('prev')}
                  disabled={!canMobileDealsScroll}
                  className="w-8 h-8 rounded-full border border-border/70 bg-background/90 dark:bg-zinc-900/80 flex items-center justify-center active:scale-95 transition-transform disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll deals right"
                  onClick={() => mobileScrollByPage('next')}
                  disabled={!canMobileDealsScroll}
                  className="w-8 h-8 rounded-full border border-border/70 bg-background/90 dark:bg-zinc-900/80 flex items-center justify-center active:scale-95 transition-transform disabled:cursor-default disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigate('/products?tag=top-deals')}
                  className="text-xs font-medium text-primary tracking-wide ml-1"
                >
                  View All
                </button>
              </div>
            </div>
          </div>
          <div ref={mobileScrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1" style={{ WebkitOverflowScrolling: 'touch', scrollPaddingLeft: '8px' }}>
            {mobileDealProducts.map((product, index) => (
              <motion.div
                key={`${product.id}-${index}`}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex-shrink-0 w-[150px] cursor-pointer"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <div className="bg-background/95 rounded-2xl overflow-hidden shadow-sm border border-white/50 dark:border-border/80">
                  <div className="aspect-square overflow-hidden bg-muted relative">
                    <img src={product.image} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                    <button
                      onClick={(e) => handleWishlistClick(e, product.id, product.title)}
                      className="absolute top-2 right-2 p-1.5 bg-background/95 dark:bg-card/95 rounded-full shadow-sm"
                    >
                      <Heart className={`w-3.5 h-3.5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                    </button>
                  </div>
                  <div className="p-2.5">
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mb-0.5">{product.title}</p>
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <div className="flex flex-wrap items-center gap-1">
                          <p className="text-sm font-bold text-foreground">₹{product.price.toLocaleString()}</p>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <p className="text-[10px] text-muted-foreground line-through">₹{product.oldPrice.toLocaleString()}</p>
                          )}
                        </div>
                        {product.discount && product.discount > 0 && (
                          <p className="text-[10px] font-semibold text-[#b88a2a] dark:text-[#f4cf73]">{product.discount}% Off</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        className="w-7 h-7 rounded-full bg-muted hover:bg-primary flex items-center justify-center transition-colors group/cart flex-shrink-0"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-muted-foreground group-hover/cart:text-white transition-colors" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ====== DESKTOP: Split layout (featured banner + product cards) ====== */}
        <div className="hidden md:block">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-px w-8 bg-primary/50" />
                <span className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-medium">
                  Top Deals
                </span>
              </div>
              <h2 className="text-3xl lg:text-4xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Handpicked savings
              </h2>
              <p className="text-sm text-muted-foreground mt-1 font-light">Handpicked deals on our finest pieces</p>
            </div>
            <button 
              onClick={() => navigate('/products?tag=top-deals')}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex gap-4 rounded-3xl overflow-hidden" style={{ minHeight: 400 }}>
            {/* Left: Featured Product Banner */}
            <div 
              className="w-[38%] relative rounded-3xl overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/product/${featuredProduct.id}`)}
            >
              <img 
                src={featuredProduct.image} 
                alt={featuredProduct.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="relative z-10 h-full flex flex-col justify-end p-8">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-2 font-light">Featured Collection</span>
                <h2 className="text-2xl font-semibold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {featuredProduct.title}
                </h2>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xl font-bold text-white">₹{featuredProduct.price.toLocaleString()}</span>
                  {featuredProduct.oldPrice && featuredProduct.oldPrice > featuredProduct.price && (
                    <span className="text-sm text-white/50 line-through">₹{featuredProduct.oldPrice.toLocaleString()}</span>
                  )}
                </div>
                <button 
                  className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-7 py-3 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 dark:bg-zinc-800 transition-all duration-300 w-fit shadow-lg"
                  onClick={(e) => { e.stopPropagation(); navigate(`/product/${featuredProduct.id}`); }}
                >
                  Shop Now
                </button>
              </div>
            </div>

            {/* Right: Product Cards Grid */}
            <div className="w-[62%] rounded-3xl border border-white/50 dark:border-border/70 bg-background/80 p-6 flex flex-col justify-between shadow-inner">
              <div className="grid grid-cols-4 gap-4">
                {visibleProducts.map((product) => (
                  <motion.div 
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-card rounded-2xl p-3 cursor-pointer hover:shadow-lg transition-all duration-300 flex flex-col group"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-2.5 relative">
                      <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <button
                        onClick={(e) => handleWishlistClick(e, product.id, product.title)}
                        className="absolute top-1.5 right-1.5 p-1 bg-background/95 dark:bg-card/95 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isInWishlist(product.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                      </button>
                    </div>
                    <div className="mt-auto">
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{product.title}</p>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex flex-col min-w-0 overflow-hidden">
                          <span className="text-sm font-bold text-foreground truncate">₹{product.price.toLocaleString()}</span>
                          {product.oldPrice && product.oldPrice > product.price && (
                            <span className="text-[10px] text-muted-foreground line-through truncate">₹{product.oldPrice.toLocaleString()}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          className="w-8 h-8 rounded-full bg-muted hover:bg-primary flex items-center justify-center transition-colors group/cart flex-shrink-0 ml-1"
                        >
                          <ShoppingCart className="w-[16px] h-[16px] text-muted-foreground group-hover/cart:text-white transition-colors" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Bottom: Navigation arrows + Shop Now */}
              <div className="flex items-center justify-between mt-5 pt-3">
                <div className="flex gap-2">
                  <button 
                    onClick={prevPage}
                    className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted hover:border-border transition-all duration-200 shadow-sm"
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={nextPage}
                    className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted hover:border-border transition-all duration-200 shadow-sm"
                  >
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <button 
                  onClick={() => navigate('/products?tag=top-deals')}
                  className="bg-primary text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-primary/90 transition-all duration-300 shadow-md"
                >
                  View Collection
                </button>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </section>
  );
};

export default TopDeals;
