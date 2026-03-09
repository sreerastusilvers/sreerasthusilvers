import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Cart Item Interface
export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category?: string;
  weight?: string;
  purity?: string;
}

// Cart Context Interface
interface CartContextType {
  items: CartItem[];
  isCartOpen: boolean;
  addToCart: (item: Omit<CartItem, 'quantity'>) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  totalItems: number;
  subtotal: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Local storage key for guest users
const CART_STORAGE_KEY = 'sree_rasthu_cart';

// Helper: save items to localStorage
const saveToLocalStorage = (cartItems: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  } catch (e) {
    console.error('localStorage save error:', e);
  }
};

// Helper: load items from localStorage
const loadFromLocalStorage = (): CartItem[] => {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadFromLocalStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const firebaseSyncRef = useRef(false);
  const pendingOpRef = useRef(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
      setAuthResolved(true);

      if (user?.uid) {
        migrateGuestCartToFirebase(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Migrate guest cart from localStorage to Firebase when user logs in
  const migrateGuestCartToFirebase = async (userId: string) => {
    try {
      const guestItems = loadFromLocalStorage();
      if (guestItems.length > 0) {
        const cartData: Record<string, CartItem> = {};
        guestItems.forEach(item => { cartData[item.id] = item; });

        await setDoc(doc(db, 'carts', userId), {
          items: cartData,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error migrating guest cart:', error);
    }
  };

  // Firebase real-time listener for logged-in users
  useEffect(() => {
    if (!currentUserId) return;

    setLoading(true);
    firebaseSyncRef.current = true;

    const cartRef = doc(db, 'carts', currentUserId);
    const unsubscribe = onSnapshot(
      cartRef,
      (snapshot) => {
        // Skip snapshot updates while a local operation is in progress
        if (pendingOpRef.current) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          const cartItems: CartItem[] = data.items ? Object.values(data.items) : [];
          setItems(cartItems);
        } else {
          setItems([]);
        }
        setLoading(false);
      },
      (error: any) => {
        console.error('Firebase cart listener error:', error?.code, error?.message);
        // Fall back to localStorage if Firebase fails
        firebaseSyncRef.current = false;
        setItems(loadFromLocalStorage());
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      firebaseSyncRef.current = false;
    };
  }, [currentUserId]);

  // Persist to localStorage whenever items change (for guest users & as fallback)
  useEffect(() => {
    if (!currentUserId) {
      saveToLocalStorage(items);
    }
  }, [items, currentUserId]);

  // ─── ADD TO CART ───
  // Always update local state immediately (optimistic), then sync to Firebase
  const addToCart = async (item: Omit<CartItem, 'quantity'>) => {
    // 1. Optimistic local state update
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    // 2. Sync to Firebase in the background (non-blocking)
    if (currentUserId) {
      try {
        const cartRef = doc(db, 'carts', currentUserId);
        const cartSnap = await getDoc(cartRef);

        let updatedItems: Record<string, CartItem> = {};
        if (cartSnap.exists()) {
          updatedItems = cartSnap.data().items || {};
        }

        if (updatedItems[item.id]) {
          updatedItems[item.id].quantity += 1;
        } else {
          updatedItems[item.id] = { ...item, quantity: 1 };
        }

        await setDoc(cartRef, {
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error: any) {
        console.error('Firebase sync failed for addToCart:', error?.code);
        // Local state already updated — cart still works
        saveToLocalStorage(items);
      }
    }
  };

  // ─── REMOVE FROM CART ───
  const removeFromCart = async (id: string) => {
    // Block onSnapshot from overwriting during this operation
    pendingOpRef.current = true;
    
    // Optimistic local update
    setItems((prev) => prev.filter((item) => item.id !== id));

    if (currentUserId) {
      try {
        const cartRef = doc(db, 'carts', currentUserId);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
          const updatedItems = { ...cartSnap.data().items };
          delete updatedItems[id];
          await setDoc(cartRef, {
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (error) {
        console.error('Firebase sync failed for removeFromCart:', error);
      }
    }
    
    // Allow onSnapshot to work again after a small delay
    setTimeout(() => { pendingOpRef.current = false; }, 500);
  };

  // ─── UPDATE QUANTITY ───
  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity <= 0) {
      return removeFromCart(id);
    }

    // Block onSnapshot from overwriting during this operation
    pendingOpRef.current = true;

    // Optimistic local update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );

    if (currentUserId) {
      try {
        const cartRef = doc(db, 'carts', currentUserId);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
          const updatedItems = { ...cartSnap.data().items };
          if (updatedItems[id]) {
            updatedItems[id].quantity = quantity;
            await setDoc(cartRef, {
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        }
      } catch (error) {
        console.error('Firebase sync failed for updateQuantity:', error);
      }
    }
    
    // Allow onSnapshot to work again after a small delay
    setTimeout(() => { pendingOpRef.current = false; }, 500);
  };

  // ─── CLEAR CART ───
  const clearCart = async () => {
    setItems([]);

    if (currentUserId) {
      try {
        const cartRef = doc(db, 'carts', currentUserId);
        await setDoc(cartRef, {
          items: {},
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Firebase sync failed for clearCart:', error);
      }
    }
  };

  // Cart drawer controls
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const value: CartContextType = {
    items,
    isCartOpen,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    toggleCart,
    totalItems,
    subtotal,
    loading,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// Custom hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
