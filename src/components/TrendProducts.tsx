import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronLeft, ChevronRight, Package, ShoppingCart, Heart } from "lucide-react";
import ProductQuickView from "./ProductQuickView";
import { subscribeToProducts } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";

const TrendProducts = () => {
  const ref = useRef(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<UIProduct | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const scrollPositionRef = useRef(0);
  const dragStartX = useRef(0);
  const dragScrollStart = useRef(0);
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();

  // Real-time listener for new arrivals
  useEffect(() => {
    const unsubscribe = subscribeToProducts(
      (fetchedProducts) => {
        // Filter for new arrivals only
        const newArrivals = fetchedProducts.filter(p => p.flags.isNewArrival);
        const uiProducts = adaptFirebaseArrayToUI(newArrivals.slice(0, 10));
        setProducts(uiProducts);
        setLoading(false);
      },
      true // activeOnly
    );

    return () => unsubscribe();
  }, []);

  const handleQuickView = (product: UIProduct) => {
    if (!isDragging) {
      setSelectedProduct(product);
      setIsQuickViewOpen(true);
    }
  };

  const closeQuickView = () => {
    setIsQuickViewOpen(false);
    setSelectedProduct(null);
  };

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

  // Manual scroll functions
  const scrollLeftBtn = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    const scrollAmount = 300;
    const halfWidth = scrollContainer.scrollWidth / 2;
    scrollPositionRef.current = scrollPositionRef.current + scrollAmount;
    
    // Reset if we've scrolled past the halfway point
    if (scrollPositionRef.current >= halfWidth) {
      scrollPositionRef.current = scrollPositionRef.current - halfWidth;
    }
    
    scrollContainer.scrollTo({
      left: scrollPositionRef.current,
      behavior: 'smooth'
    });
  };

  const scrollRightBtn = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    const scrollAmount = 300;
    const halfWidth = scrollContainer.scrollWidth / 2;
    scrollPositionRef.current = scrollPositionRef.current - scrollAmount;
    
    // Reset if we've gone below 0
    if (scrollPositionRef.current < 0) {
      scrollPositionRef.current = halfWidth + scrollPositionRef.current;
    }
    
    scrollContainer.scrollTo({
      left: scrollPositionRef.current,
      behavior: 'smooth'
    });
  };

  // Handle drag/swipe scrolling
  const handleDragStart = (clientX: number) => {
    setIsDragging(true);
    setIsPaused(true);
    dragStartX.current = clientX;
    dragScrollStart.current = scrollPositionRef.current;
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging || !scrollRef.current) return;
    
    const diff = dragStartX.current - clientX;
    const halfWidth = scrollRef.current.scrollWidth / 2;
    let newPosition = dragScrollStart.current + diff;
    
    // Handle wrapping
    if (newPosition < 0) {
      newPosition = halfWidth + newPosition;
    } else if (newPosition >= halfWidth) {
      newPosition = newPosition - halfWidth;
    }
    
    scrollPositionRef.current = newPosition;
    scrollRef.current.scrollLeft = newPosition;
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Small delay before resuming auto-scroll
    setTimeout(() => setIsPaused(false), 1000);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleDragEnd();
    }
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // No duplication - removed auto-scroll animation
  const displayProducts = products;

  return (
    <section ref={ref} className="py-3 md:py-10 bg-background">
      <div className="container-custom">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-3 md:mb-8 hidden md:flex md:items-end md:justify-between"
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground font-serif">
              New Arrivals
            </h2>
            <p className="text-sm text-muted-foreground mt-1 font-light">Fresh designs crafted just for you</p>
          </div>
          <button onClick={() => navigate('/jewelry')} className="text-sm text-primary font-medium hover:underline underline-offset-4 flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
        {/* Mobile header without animation */}
        <div className="mb-3 md:mb-6 md:hidden flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold text-foreground font-serif">
            New Arrivals
          </h2>
          <button onClick={() => navigate('/jewelry')} className="text-xs text-primary font-medium">
            View All
          </button>
        </div>

        {/* Products Container */}
        <div className="relative">
          {/* Left Arrow - Only show if we have many products */}
          {products.length > 3 && (
            <button
              onClick={scrollLeftBtn}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background transition-all hover:scale-105 -ml-2 md:-ml-5 flex items-center justify-center"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Right Arrow - Only show if we have many products */}
          {products.length > 3 && (
            <button
              onClick={scrollRightBtn}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background transition-all hover:scale-105 -mr-2 md:-mr-5 flex items-center justify-center"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div 
            ref={scrollRef}
            className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide pb-4 md:snap-x md:snap-mandatory md:cursor-grab md:active:cursor-grabbing select-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {loading ? (
              // Loading skeleton
              Array.from({ length: 10 }).map((_, index) => (
                <div 
                  key={`skeleton-${index}`} 
                  className="flex-shrink-0 w-[130px] md:w-[220px] snap-start"
                >
                  <div className="animate-pulse">
                    <div className="bg-gray-200 dark:bg-muted rounded-lg aspect-square mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-muted rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-muted rounded w-2/3"></div>
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              // Empty state
              <div className="w-full py-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No trending products available yet.</p>
              </div>
            ) : (
              displayProducts.map((product, index) => (
                <div
                  key={`${product.id}-${index}`}
                  className="flex-shrink-0 w-[150px] md:w-[230px] md:snap-start cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="bg-card rounded-2xl overflow-hidden h-full flex flex-col border border-border hover:shadow-lg transition-shadow duration-300">
                    {/* Image */}
                    <div className="aspect-square overflow-hidden bg-secondary/50 dark:bg-muted relative group">
                      <img
                        src={product.image}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      
                      {/* Discount Badge */}
                      {product.discount && product.discount > 0 && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[10px] lg:text-xs font-semibold px-2 py-1 rounded-full">
                          {product.discount}% OFF
                        </div>
                      )}
                      
                      {/* Wishlist Button */}
                      <button
                        onClick={(e) => handleWishlistClick(e, product.id, product.title)}
                        className="absolute top-2 right-2 p-1.5 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-background transition-all duration-200 z-10"
                        aria-label="Add to wishlist"
                      >
                        <Heart 
                          className={`w-3.5 h-3.5 md:w-4 md:h-4 ${
                            isInWishlist(product.id) 
                              ? 'fill-red-500 text-red-500' 
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-2.5 md:p-3.5 flex flex-col flex-grow">
                      {/* Category Badge */}
                      {product.category && (
                        <span className="text-[9px] uppercase tracking-widest text-primary/70 font-medium mb-1">
                          NEW ARRIVAL
                        </span>
                      )}
                      
                      <h3 className="text-xs md:text-sm font-medium text-foreground line-clamp-1 mb-1.5">
                        {product.title}
                      </h3>
                      
                      <div className="mt-auto">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-sm md:text-base font-bold text-foreground">
                              ₹{product.price.toLocaleString()}
                            </p>
                            {product.oldPrice && product.oldPrice > product.price && (
                              <p className="text-[10px] md:text-xs text-muted-foreground line-through">
                                ₹{product.oldPrice.toLocaleString()}
                              </p>
                            )}
                          </div>
                          
                          {/* Cart Button */}
                          <button
                            onClick={(e) => handleAddToCart(e, product)}
                            className="w-8 h-8 rounded-full bg-muted hover:bg-primary flex items-center justify-center transition-colors duration-200 group/cart"
                            aria-label="Add to cart"
                          >
                            <ShoppingCart className="w-4 h-4 text-muted-foreground group-hover/cart:text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Product Quick View Modal */}
      <ProductQuickView
        product={selectedProduct}
        isOpen={isQuickViewOpen}
        onClose={closeQuickView}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default TrendProducts;
