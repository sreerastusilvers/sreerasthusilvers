import { motion } from "framer-motion";
import { Star, Heart, Eye, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { useWishlist } from "@/hooks/useWishlist";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  title: string;
  category: string;
  price: number;
  oldPrice?: number | null;
  rating: number;
  reviews: number;
  image: string;
  alt?: string;
  badge?: string;
  discount?: number;
}

interface ProductCardProps {
  product: Product;
  index?: number;
  onQuickView?: (product: Product) => void;
}

const ProductCard = ({ product, index = 0, onQuickView }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();

  const handleCardClick = () => {
    // Navigate to product detail page
    navigate(`/product/${product.id}`);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuickView?.(product);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id, product.title);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    console.log('🛒 Add to Cart clicked for:', product.title);
    console.log('📦 Product ID:', product.id);
    
    try {
      await addToCart({
        id: product.id,
        name: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
      });
      
      console.log('✅ Successfully added to cart');
      
      toast({
        title: "Added to cart",
        description: `${product.title} has been added to your cart.`,
      });
    } catch (error) {
      console.error('❌ Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="product-card group cursor-pointer border border-gray-200 rounded-xl p-2 lg:p-0 lg:border-0"
      onClick={handleCardClick}
    >
      {/* Image Container */}
      <div className="product-card-image relative bg-muted rounded-xl lg:rounded-2xl overflow-hidden aspect-square mb-2 lg:mb-3">
        <img
          src={product.image}
          alt={product.alt || product.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Discount Badge - Top Left */}
        {product.discount && product.discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] lg:text-xs font-bold px-2 py-1 rounded-md shadow-lg">
            {product.discount}% OFF
          </div>
        )}

        {/* Wishlist Heart - Top Right */}
        <button
          onClick={handleWishlistClick}
          className="absolute top-1.5 right-1.5 lg:top-2 lg:right-2 p-1.5 lg:p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-all"
          aria-label={isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart 
            className={`w-4 h-4 lg:w-5 lg:h-5 transition-colors ${
              isInWishlist(product.id) 
                ? "text-red-500 fill-red-500" 
                : "text-gray-700 hover:text-red-500"
            }`}
          />
        </button>
      </div>

      {/* Product Info */}
      <div className="space-y-0.5 lg:space-y-1.5">
        {/* Category */}
        <span className="text-[10px] lg:text-xs uppercase tracking-wider font-medium" style={{ color: '#D4AF37' }}>
          {product.category}
        </span>

        {/* Title - Single Line with Ellipsis */}
        <h4 className="font-medium text-xs lg:text-base leading-snug text-gray-900 truncate" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {product.title}
        </h4>

        {/* Rating - Without Review Count */}
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 lg:w-4 lg:h-4 ${
                i < Math.floor(product.rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Price */}
        <div className="flex items-center gap-1.5 lg:gap-2 pt-0.5 lg:pt-1">
          <span className="text-sm lg:text-xl font-bold text-gray-900">₹{product.price.toLocaleString('en-IN')}</span>
          {product.oldPrice && (
            <span className="text-[10px] lg:text-sm text-gray-400 line-through">
              ₹{product.oldPrice.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          className="w-full mt-1 lg:mt-2 py-1.5 lg:py-2.5 px-3 lg:px-4 bg-black/5 text-gray-900 text-[11px] lg:text-sm font-medium rounded-full hover:bg-black/10 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-1.5 lg:gap-2 border border-gray-200"
        >
          <ShoppingBag className="w-3 h-3 lg:w-4 lg:h-4" />
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
