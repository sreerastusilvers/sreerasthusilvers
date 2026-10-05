import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Add-to-cart feedback, shared by every "Add to cart" button on the site.
 *
 * `CartContext.addToCart` publishes here on success and on a refused add
 * (out of stock, quantity limit), and <CartConfirmation /> renders the result
 * once for the whole app. Call sites therefore never build their own toast:
 * whichever page, card or carousel added the item, the shopper sees the same
 * confirmation panel.
 *
 * A tiny external store rather than React context, so the cart context can
 * publish without re-rendering every consumer and any component can read it.
 */

export interface CartFeedbackItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  category?: string;
  weight?: string;
  purity?: string;
}

export type CartFeedbackEvent =
  | {
      id: number;
      kind: 'added';
      item: CartFeedbackItem;
      /** How many were added by this click. */
      quantity: number;
      /** The line's quantity in the cart after the add. */
      lineQuantity: number;
    }
  | {
      id: number;
      kind: 'error';
      item?: CartFeedbackItem;
      title: string;
      message: string;
    };

interface LastAdded {
  id: number;
  productId: string;
  at: number;
}

let current: CartFeedbackEvent | null = null;
let lastAdded: LastAdded | null = null;
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyAdded = (item: CartFeedbackItem, quantity: number, lineQuantity: number) => {
  counter += 1;
  current = { id: counter, kind: 'added', item, quantity, lineQuantity };
  lastAdded = { id: counter, productId: item.id, at: Date.now() };
  emit();
};

export const notifyCartError = (title: string, message: string, item?: CartFeedbackItem) => {
  counter += 1;
  current = { id: counter, kind: 'error', item, title, message };
  emit();
};

export const dismissCartFeedback = () => {
  if (!current) return;
  current = null;
  emit();
};

/** The confirmation currently on screen, or null. */
export const useCartFeedback = () => useSyncExternalStore(subscribe, () => current, () => null);

/**
 * True for a moment after `productId` was added, so the button that was
 * pressed can say "Added" before settling back.
 */
export const useJustAdded = (productId: string | undefined | null, ms = 1600) => {
  const last = useSyncExternalStore(subscribe, () => lastAdded, () => null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!last || !productId || last.productId !== productId) {
      setActive(false);
      return;
    }
    const remaining = ms - (Date.now() - last.at);
    if (remaining <= 0) {
      setActive(false);
      return;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), remaining);
    return () => window.clearTimeout(timer);
  }, [last, productId, ms]);

  return active;
};
