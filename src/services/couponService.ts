import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
  where,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export type CouponType = 'percent' | 'flat';

export interface Coupon {
  id?: string;
  code: string;             // uppercase unique
  description?: string;
  type: CouponType;
  value: number;            // percent 1-100 OR flat amount
  minOrderValue: number;    // ₹ minimum cart total
  maxDiscount?: number;     // optional cap for percent type
  maxUses: number;          // 0 = unlimited
  usedCount: number;
  perUserLimit?: number;    // 0 = unlimited
  validFrom?: Timestamp | null;
  validTo?: Timestamp | null;
  active: boolean;
  applicableCategories?: string[]; // empty = all
  firstOrderOnly?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const COUPONS = 'coupons';

export const subscribeCoupons = (cb: (items: Coupon[]) => void) => {
  const q = query(collection(db, COUPONS), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  });
};

export const getCoupons = async (): Promise<Coupon[]> => {
  const snap = await getDocs(query(collection(db, COUPONS), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
};

export const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  const q = query(
    collection(db, COUPONS),
    where('code', '==', code.toUpperCase()),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) };
};

export const createCoupon = async (data: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt' | 'usedCount'>) => {
  const payload = {
    ...data,
    code: data.code.toUpperCase().trim(),
    usedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COUPONS), payload);
  return ref.id;
};

export const updateCoupon = async (id: string, data: Partial<Coupon>) => {
  const payload: any = { ...data, updatedAt: serverTimestamp() };
  if (data.code) payload.code = data.code.toUpperCase().trim();
  await updateDoc(doc(db, COUPONS, id), payload);
};

export const deleteCoupon = async (id: string) => {
  await deleteDoc(doc(db, COUPONS, id));
};

export const incrementCouponUsage = async (id: string) => {
  await updateDoc(doc(db, COUPONS, id), { usedCount: increment(1), updatedAt: serverTimestamp() });
};

/**
 * Discount for a coupon against a subtotal.
 *
 * Extracted so the value can be recomputed whenever the cart changes rather
 * than being captured once when the code was applied. A stale figure made the
 * client total disagree with the server's re-price, and /api/create-order then
 * refused the payment with "Order total mismatch".
 *
 * Must stay in step with `couponDiscount` in api/create-order.ts.
 */
export const computeCouponDiscount = (coupon: Coupon, cartTotal: number): number => {
  if (coupon.type === 'percent') {
    let discount = Math.floor((cartTotal * coupon.value) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    return discount;
  }
  return Math.min(coupon.value, cartTotal);
};

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discount?: number;
  coupon?: Coupon;
}

/**
 * How many orders this customer has already placed, optionally narrowed to the
 * ones that used a particular coupon code.
 *
 * Used to enforce `perUserLimit` and `firstOrderOnly`, which were previously
 * stored by the admin panel and then never checked anywhere - a coupon capped
 * at "1 per user" could be redeemed by the same account on every order until
 * the global `maxUses` ran out.
 *
 * Counted with an aggregate query (one read) and falls back to a plain query if
 * aggregates are unavailable. A counting failure must never block a paying
 * customer, so the caller treats `null` as "unknown, allow".
 */
const countUserOrders = async (userId: string, couponCode?: string): Promise<number | null> => {
  const constraints = [where('userId', '==', userId)];
  if (couponCode) constraints.push(where('couponCode', '==', couponCode.toUpperCase()));

  try {
    const snap = await getCountFromServer(query(collection(db, 'orders'), ...constraints));
    return snap.data().count;
  } catch {
    // Index merging unavailable, or aggregates blocked - read the docs instead.
    try {
      const snap = await getDocs(query(collection(db, 'orders'), where('userId', '==', userId)));
      if (!couponCode) return snap.size;
      const wanted = couponCode.toUpperCase();
      return snap.docs.filter((d) => String((d.data() as any).couponCode || '').toUpperCase() === wanted).length;
    } catch {
      return null;
    }
  }
};

export const validateCoupon = async (
  code: string,
  cartTotal: number,
  cartCategoryIds: string[] = [],
  userId?: string,
): Promise<CouponValidationResult> => {
  const coupon = await getCouponByCode(code);
  if (!coupon) return { valid: false, reason: 'Coupon code does not exist' };
  if (!coupon.active) return { valid: false, reason: 'This coupon is inactive' };

  const now = new Date();
  if (coupon.validFrom && coupon.validFrom.toDate() > now) {
    return { valid: false, reason: 'Coupon is not yet active' };
  }
  if (coupon.validTo && coupon.validTo.toDate() < now) {
    return { valid: false, reason: 'Coupon has expired' };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }
  if (cartTotal < coupon.minOrderValue) {
    return {
      valid: false,
      reason: `Add ₹${(coupon.minOrderValue - cartTotal).toLocaleString('en-IN')} more to use this coupon`,
    };
  }
  // Category restriction. `cartCategoryIds` is compared case-insensitively
  // because the admin stores category *names* while cart lines carry whatever
  // casing the product document used.
  if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
    const allowed = coupon.applicableCategories.map((c) => String(c).trim().toLowerCase());
    const inCart = cartCategoryIds.map((c) => String(c).trim().toLowerCase());
    if (!inCart.some((c) => allowed.includes(c))) {
      return { valid: false, reason: 'Coupon not valid for the items in your cart' };
    }
  }

  // Per-customer limits. Both need the signed-in user; when the caller has no
  // uid (shouldn't happen at checkout, which requires auth) the limits are
  // skipped rather than guessed at.
  if (userId) {
    if (coupon.firstOrderOnly) {
      const placed = await countUserOrders(userId);
      if (placed !== null && placed > 0) {
        return { valid: false, reason: 'This coupon is only valid on your first order' };
      }
    }
    if (coupon.perUserLimit && coupon.perUserLimit > 0) {
      const used = await countUserOrders(userId, coupon.code);
      if (used !== null && used >= coupon.perUserLimit) {
        return {
          valid: false,
          reason:
            coupon.perUserLimit === 1
              ? 'You have already used this coupon'
              : `You have already used this coupon ${coupon.perUserLimit} times`,
        };
      }
    }
  }

  return { valid: true, discount: computeCouponDiscount(coupon, cartTotal), coupon };
};

export const getCoupon = async (id: string): Promise<Coupon | null> => {
  const ref = doc(db, COUPONS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
};
