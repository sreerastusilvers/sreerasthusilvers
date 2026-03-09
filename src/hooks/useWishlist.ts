import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const WISHLIST_STORAGE_KEY = 'sree_rasthu_wishlist';

interface WishlistItem {
  productId: string;
  addedAt: number;
}

// Local storage functions
const getWishlistFromStorage = (): string[] => {
  try {
    const stored = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (stored) {
      const items: WishlistItem[] = JSON.parse(stored);
      return items.map(item => item.productId);
    }
  } catch (error) {
    console.error('Error reading wishlist from storage:', error);
  }
  return [];
};

const saveWishlistToStorage = (productIds: string[]) => {
  try {
    const items: WishlistItem[] = productIds.map(productId => ({
      productId,
      addedAt: Date.now()
    }));
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error saving wishlist to storage:', error);
  }
};

export const useWishlist = () => {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load wishlist from localStorage on mount
  useEffect(() => {
    const storedWishlist = getWishlistFromStorage();
    setWishlist(storedWishlist);
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever wishlist changes
  useEffect(() => {
    if (isLoaded) {
      saveWishlistToStorage(wishlist);
    }
  }, [wishlist, isLoaded]);

  const addToWishlist = useCallback((productId: string, productTitle?: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login or signup to add items to your wishlist",
        variant: "destructive",
      });
      return false;
    }

    if (wishlist.includes(productId)) {
      return false;
    }

    setWishlist(prev => [...prev, productId]);
    toast({
      title: "Added to Wishlist",
      description: productTitle || "Product added to your wishlist",
    });
    return true;
  }, [user, wishlist]);

  const removeFromWishlist = useCallback((productId: string, productTitle?: string) => {
    setWishlist(prev => prev.filter(id => id !== productId));
    toast({
      title: "Removed from Wishlist",
      description: productTitle || "Product removed from your wishlist",
      variant: "default",
    });
    return true;
  }, []);

  const toggleWishlist = useCallback((productId: string, productTitle?: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login or signup to add items to your wishlist",
        variant: "destructive",
      });
      return;
    }

    const isInWishlist = wishlist.includes(productId);
    if (isInWishlist) {
      removeFromWishlist(productId, productTitle);
    } else {
      addToWishlist(productId, productTitle);
    }
  }, [user, wishlist, addToWishlist, removeFromWishlist]);

  const isInWishlist = useCallback((productId: string) => {
    return wishlist.includes(productId);
  }, [wishlist]);

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    localStorage.removeItem(WISHLIST_STORAGE_KEY);
  }, []);

  return {
    wishlist,
    isLoaded,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isInWishlist,
    clearWishlist,
    wishlistCount: wishlist.length,
  };
};
