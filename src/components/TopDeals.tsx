import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ShoppingCart, Heart } from "lucide-react";
import { getAllProducts } from "@/services/productService";
import { UIProduct, adaptFirebaseToUI } from "@/lib/productAdapter";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";

const TopDeals = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const allProducts = await getAllProducts();
        const uiProducts = allProducts.map(p => adaptFirebaseToUI(p as any));
        // Filter products by "Top Deals" category
        const topDealsProducts = uiProducts.filter(p => p.category === "Top Deals");
        setProducts(topDealsProducts);
      } catch (error) {
        console.error('Error loading top deals:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
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

  if (loading) {
    return (
      <section className="py-12 bg-gray-50">
        <div className="container-custom">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-3 md:py-8 bg-gray-50">
      <div className="container-custom md:bg-white md:rounded-lg md:shadow-lg md:p-6">
        <h2 className="text-lg md:text-3xl font-semibold text-gray-900 mb-3 md:mb-6" style={{ fontFamily: 'Poppins, sans-serif' }}>
          Top Deals
        </h2>

        <div className="relative">
          {/* Scrollable container */}
          <div className="flex gap-2 md:gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex-shrink-0 w-[130px] md:w-[220px] snap-start cursor-pointer"
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
                    <h3 className="text-xs md:text-sm font-semibold text-gray-900 line-clamp-1 mb-1 md:mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
              </motion.div>
            ))}

            {/* Scroll indicator */}
            <div className="flex-shrink-0 w-20 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
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

export default TopDeals;
