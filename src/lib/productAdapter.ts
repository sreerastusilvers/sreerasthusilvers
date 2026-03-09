import { Product as FirebaseProduct } from "@/services/productService";

/**
 * UI Product interface matching existing component expectations
 * This matches the hardcoded product structure used throughout the app
 */
export interface UIProduct {
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

/**
 * Adapts Firebase product schema to UI product schema
 * Ensures seamless integration without changing existing UI components
 * 
 * @param fbProduct - Product from Firebase/Firestore
 * @returns UIProduct - Product formatted for existing UI components
 */
export const adaptFirebaseToUI = (fbProduct: FirebaseProduct): UIProduct => {
  // Use explicit discount field if set, otherwise calculate from original price
  let discount: number | undefined;
  
  if (fbProduct.discount !== undefined && fbProduct.discount > 0) {
    // Use explicit discount from admin
    discount = Math.round(fbProduct.discount);
  } else if (fbProduct.originalPrice && fbProduct.originalPrice > fbProduct.price) {
    // Calculate discount percentage if original price exists
    discount = Math.round(((fbProduct.originalPrice - fbProduct.price) / fbProduct.originalPrice) * 100);
  }

  // Determine badge based on product flags
  let badge: string | undefined;
  if (fbProduct.flags.isFeatured) {
    badge = "Featured";
  } else if (fbProduct.flags.isNewArrival) {
    badge = "New Arrival";
  } else if (fbProduct.flags.isBestSeller) {
    badge = "Best Seller";
  }

  return {
    id: fbProduct.id!,
    title: fbProduct.name,
    category: fbProduct.category,
    price: fbProduct.price,
    oldPrice: fbProduct.originalPrice || null,
    rating: 4.5, // Default rating until review system is implemented
    reviews: 0,  // Default review count until review system is implemented
    image: fbProduct.media.thumbnail || fbProduct.media.images[0] || "/placeholder-product.jpg",
    alt: fbProduct.name,
    badge,
    discount,
  };
};

/**
 * Adapts array of Firebase products to UI products
 * 
 * @param fbProducts - Array of products from Firebase
 * @returns Array of UIProducts
 */
export const adaptFirebaseArrayToUI = (fbProducts: FirebaseProduct[]): UIProduct[] => {
  console.log('Adapter: Converting', fbProducts.length, 'Firebase products to UI format');
  const adapted = fbProducts.map(adaptFirebaseToUI);
  console.log('Adapter: Converted products:', adapted);
  return adapted;
};

/**
 * Extended UI Product interface for product detail pages
 * Includes additional fields like description and images array
 */
export interface UIProductDetail extends UIProduct {
  description?: string;
  images: string[];
  specifications?: {
    material?: string;
    purity?: string;
    dimensions?: string;
  };
}

/**
 * Adapts Firebase product to detailed UI product (for product detail pages)
 * 
 * @param fbProduct - Product from Firebase
 * @returns UIProductDetail with additional fields
 */
export const adaptFirebaseToUIDetail = (fbProduct: FirebaseProduct): UIProductDetail => {
  const baseProduct = adaptFirebaseToUI(fbProduct);
  
  return {
    ...baseProduct,
    description: fbProduct.description,
    images: fbProduct.media.images || [],
    specifications: fbProduct.specifications || {},
  };
};
