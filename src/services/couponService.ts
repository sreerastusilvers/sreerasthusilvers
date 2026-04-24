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

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discount?: number;
  coupon?: Coupon;
}

export const validateCoupon = async (
  code: string,
  cartTotal: number,
  cartCategoryIds: string[] = [],
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
  if (
    coupon.applicableCategories &&
    coupon.applicableCategories.length > 0 &&
    !cartCategoryIds.some((c) => coupon.applicableCategories!.includes(c))
  ) {
    return { valid: false, reason: 'Coupon not valid for the items in your cart' };
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.floor((cartTotal * coupon.value) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.value, cartTotal);
  }

  return { valid: true, discount, coupon };
};

export const getCoupon = async (id: string): Promise<Coupon | null> => {
  const ref = doc(db, COUPONS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) };
};
