import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CLOUDINARY_UPLOAD_URL, cloudinaryConfig } from '@/config/cloudinary';

export interface Review {
  id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number; // 1-5
  reviewText: string;
  images: string[]; // URLs of uploaded images
  videoUrl?: string; // URL of uploaded video
  isVerifiedPurchase: boolean; // True if user has ordered this product
  status: 'pending' | 'approved' | 'rejected'; // For admin moderation
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ReviewFormData = Omit<Review, 'id' | 'createdAt' | 'updatedAt'>;

const REVIEWS_COLLECTION = 'reviews';

/**
 * Check if user has purchased a specific product
 */
export const hasUserPurchasedProduct = async (
  userId: string,
  productId: string
): Promise<boolean> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('userId', '==', userId),
      where('status', '==', 'delivered')
    );
    
    const snapshot = await getDocs(q);
    
    // Check if any delivered order contains this product
    for (const doc of snapshot.docs) {
      const order = doc.data();
      const hasProduct = order.items?.some((item: any) => item.productId === productId);
      if (hasProduct) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user purchase:', error);
    return false;
  }
};

/**
 * Check if user has already reviewed a product
 */
export const hasUserReviewedProduct = async (
  userId: string,
  productId: string
): Promise<boolean> => {
  try {
    const reviewsRef = collection(db, REVIEWS_COLLECTION);
    const q = query(
      reviewsRef,
      where('userId', '==', userId),
      where('productId', '==', productId),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking user review:', error);
    return false;
  }
};

/**
 * Upload a file to Cloudinary
 */
const uploadToCloudinary = async (file: File, folder: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', folder);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  return data.secure_url;
};

/**
 * Upload review images to Cloudinary
 */
export const uploadReviewImages = async (
  files: File[],
  userId: string,
  productId: string
): Promise<string[]> => {
  const folder = `reviews/${userId}/${productId}`;
  const uploadPromises = files.map((file) => uploadToCloudinary(file, folder));
  return Promise.all(uploadPromises);
};

/**
 * Upload review video to Cloudinary
 */
export const uploadReviewVideo = async (
  file: File,
  userId: string,
  productId: string
): Promise<string> => {
  const folder = `reviews/${userId}/${productId}`;
  return uploadToCloudinary(file, folder);
};

/**
 * Create a new review
 */
export const createReview = async (reviewData: ReviewFormData): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
    ...reviewData,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

/**
 * Get reviews for a specific product
 */
export const getProductReviews = async (
  productId: string,
  status: 'approved' | 'all' = 'approved'
): Promise<Review[]> => {
  try {
    const reviewsRef = collection(db, REVIEWS_COLLECTION);
    let q;
    
    if (status === 'approved') {
      q = query(
        reviewsRef,
        where('productId', '==', productId),
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        reviewsRef,
        where('productId', '==', productId),
        orderBy('createdAt', 'desc')
      );
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data() as Record<string, any>;
      return { ...data, id: d.id } as Review;
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return [];
  }
};

/**
 * Get all reviews (for admin)
 */
export const getAllReviews = async (): Promise<Review[]> => {
  try {
    const reviewsRef = collection(db, REVIEWS_COLLECTION);
    const q = query(reviewsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(d => {
      const data = d.data() as Record<string, any>;
      return { ...data, id: d.id } as Review;
    });
  } catch (error) {
    console.error('Error fetching all reviews:', error);
    return [];
  }
};

/**
 * Subscribe to reviews (real-time updates for admin)
 */
export const subscribeToReviews = (
  callback: (reviews: Review[]) => void
): (() => void) => {
  const reviewsRef = collection(db, REVIEWS_COLLECTION);
  const q = query(reviewsRef, orderBy('createdAt', 'desc'));
  
  const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot) => {
    const reviews = snapshot.docs.map(d => {
      const data = d.data() as Record<string, any>;
      return { ...data, id: d.id } as Review;
    });
    callback(reviews);
  });
  
  return unsubscribe;
};

/**
 * Update review status (for admin)
 */
export const updateReviewStatus = async (
  reviewId: string,
  status: 'approved' | 'rejected'
): Promise<void> => {
  const reviewRef = doc(db, REVIEWS_COLLECTION, reviewId);
  await updateDoc(reviewRef, {
    status,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Delete a review (for admin)
 */
export const deleteReview = async (reviewId: string): Promise<void> => {
  const reviewRef = doc(db, REVIEWS_COLLECTION, reviewId);
  await deleteDoc(reviewRef);
};

/**
 * Get review statistics for a product
 */
export const getProductReviewStats = async (
  productId: string
): Promise<{
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}> => {
  try {
    const reviews = await getProductReviews(productId, 'approved');
    
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
    
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(review => {
      ratingDistribution[review.rating] = (ratingDistribution[review.rating] || 0) + 1;
    });
    
    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution,
    };
  } catch (error) {
    console.error('Error calculating review stats:', error);
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
};
