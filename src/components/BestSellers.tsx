import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { ChevronLeft, ChevronRight, Package, ShoppingCart, Heart } from "lucide-react";
import { subscribeToBestSellers } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";

const BestSellers = () => {
  const ref = useRef(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const scrollPositionRef = useRef(0);
  const dragStartX = useRef(0);
  const dragScrollStart = useRef(0);
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();

  // Real-time subscription to best sellers
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToBestSellers((fbProducts) => {
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
  const scrollLeft = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    const scrollAmount = 300;
    scrollPositionRef.current = Math.max(0, scrollPositionRef.current - scrollAmount);
    scrollContainer.scrollTo({
      left: scrollPositionRef.current,
      behavior: 'smooth'
    });
  };

  const scrollRight = () => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    const scrollAmount = 300;
    const halfWidth = scrollContainer.scrollWidth / 2;
    scrollPositionRef.current = Math.min(halfWidth, scrollPositionRef.current + scrollAmount);
    
    // Reset if we've scrolled past the halfway point
    if (scrollPositionRef.current >= halfWidth) {
      scrollPositionRef.current = 0;
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

  // Auto-scroll functionality (disabled on mobile)
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer || products.length <= 3) return; // Don't auto-scroll if few products

    // Disable auto-scroll on mobile/tablet (< 1024px)
    const checkIsMobile = () => window.innerWidth < 1024;
    if (checkIsMobile()) return;

    let animationId: number;
    const scrollSpeed = 1.5; // pixels per frame

    const scroll = () => {
      // Double-check on each frame to ensure we're still on desktop
      if (checkIsMobile()) {
        cancelAnimationFrame(animationId);
        return;
      }

      if (!isPaused && scrollContainer) {
        scrollPositionRef.current += scrollSpeed;
        
        // Reset scroll when reaching the middle (since we duplicated products)
        const halfWidth = scrollContainer.scrollWidth / 2;
        if (scrollPositionRef.current >= halfWidth) {
          scrollPositionRef.current = 0;
        }
        
        scrollContainer.scrollLeft = scrollPositionRef.current;
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isPaused, products.length]);

  // Don't duplicate products on mobile for better scroll performance
  const displayProducts = products;

  return (
    <section ref={ref} className="py-3 md:py-8 bg-gray-50">
      <div className="container-custom md:bg-white md:rounded-lg md:shadow-lg md:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-3 md:mb-6 hidden md:block"
        >
          <h2 className="text-lg md:text-3xl font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Best Sellers
          </h2>
        </motion.div>
        {/* Mobile header without animation */}
        <div className="mb-3 md:mb-6 md:hidden">
          <h2 className="text-lg md:text-3xl font-semibold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Best Sellers
          </h2>
        </div>

        {/* Products Container */}
        <div className="relative">
          {/* Left Arrow - Only show if we have many products */}
          {products.length > 3 && (
            <button
              onClick={scrollLeft}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all hover:scale-110 -ml-2 md:-ml-4"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          {/* Right Arrow - Only show if we have many products */}
          {products.length > 3 && (
            <button
              onClick={scrollRight}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all hover:scale-110 -mr-2 md:-mr-4"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
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
                    <div className="bg-gray-200 rounded-lg aspect-square mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              // Empty state
              <div className="w-full py-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No best sellers available yet.</p>
              </div>
            ) : (
              displayProducts.map((product, index) => {
                return (
                  <div
                    key={`${product.id}-${index}`}
                    className="flex-shrink-0 w-[130px] md:w-[220px] md:snap-start cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="bg-white rounded-lg overflow-hidden h-full flex flex-col border border-gray-100 md:shadow-sm">
                      {/* Image */}
                      <div className="aspect-square overflow-hidden bg-gray-100 relative group">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        />
                        
                        {/* Discount Badge */}
                        {product.discount && product.discount > 0 && (
                          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] lg:text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                            {product.discount}% OFF
                          </div>
                        )}
                        
                        {/* Wishlist Button */}
                        <button
                          onClick={(e) => handleWishlistClick(e, product.id, product.title)}
                          className="absolute top-1 right-1 md:top-2 md:right-2 p-1 md:p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all duration-200 z-10"
                          aria-label="Add to wishlist"
                        >
                          <Heart 
                            className={`w-3 h-3 md:w-4 md:h-4 ${
                              isInWishlist(product.id) 
                                ? 'fill-red-500 text-red-500' 
                                : 'text-gray-600'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-2 md:p-3 flex flex-col flex-grow">
                        {/* Category Badge */}
                        {product.category && (
                          <span className="text-[10px] uppercase tracking-wider text-amber-600 font-medium mb-1">
                            BEST SELLERS
                          </span>
                        )}
                        
                        <h3 className="text-xs md:text-sm font-semibold text-gray-900 line-clamp-1 mb-1 md:mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                          {product.title}
                        </h3>
                        
                        <div className="mt-auto">
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-sm md:text-lg font-bold text-gray-900">
                                ₹{product.price.toLocaleString()}
                              </p>
                              {product.oldPrice && product.oldPrice > product.price && (
                                <p className="text-[10px] md:text-xs text-gray-500 line-through">
                                  ₹{product.oldPrice.toLocaleString()}
                                </p>
                              )}
                            </div>
                            
                            {/* Cart Button */}
                            <button
                              onClick={(e) => handleAddToCart(e, product)}
                              className="hover:scale-110 transition-transform duration-200"
                              aria-label="Add to cart"
                            >
                              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-[#8B7355]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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

export default BestSellers;
