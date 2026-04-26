import { useEffect, useMemo, useState } from 'react';
import {
  subscribeDeliverySettings,
  subscribeGstSettings,
  computeDeliveryCharge,
  computeGst,
  DEFAULT_DELIVERY,
  DEFAULT_GST,
  type DeliverySettings,
  type GstSettings,
} from '@/services/siteSettingsService';
import {
  validateCoupon,
  subscribeCoupons,
  type Coupon,
} from '@/services/couponService';

export interface CheckoutPricing {
  subtotal: number;
  deliveryCharge: number;
  freeDelivery: boolean;
  gstAmount: number;
  gstAddOnTop: boolean;
  discount: number;
  codCharge: number;
  total: number;
  appliedCoupon: Coupon | null;
  couponError: string | null;
  coupons: Coupon[];
  delivery: DeliverySettings;
  gst: GstSettings;
  applyCoupon: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  removeCoupon: () => void;
  setIsCod: (v: boolean) => void;
}

/**
 * Centralised pricing engine consumed by Checkout / MobileCheckout. All
 * numbers come from admin-managed Firestore documents (siteSettings/*) so
 * editing them in /admin/commerce-settings reflects everywhere instantly.
 *
 * Coupons are validated against the `coupons` Firestore collection managed
 * via the admin panel — the single source of truth for coupon data.
 */
export function useCheckoutPricing(
  subtotal: number,
  isEmpty: boolean,
  paymentMethod: string
): CheckoutPricing {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [gst, setGst] = useState<GstSettings>(DEFAULT_GST);

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeCoupons(setCoupons);
    const u2 = subscribeDeliverySettings(setDelivery);
    const u3 = subscribeGstSettings(setGst);
    return () => { u1?.(); u2?.(); u3?.(); };
  }, []);

  // Drop coupon if cart total drops below the coupon's minimum order value
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.minOrderValue && subtotal < appliedCoupon.minOrderValue) {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(`Coupon removed: minimum order of ₹${appliedCoupon.minOrderValue.toLocaleString('en-IN')} required`);
    }
  }, [subtotal, appliedCoupon]);

  const isCod = paymentMethod?.toLowerCase().includes('cash') || paymentMethod?.toLowerCase().includes('cod');

  const pricing = useMemo(() => {
    if (isEmpty) {
      return { deliveryCharge: 0, freeDelivery: false, gstAmount: 0, gstAddOnTop: false, codCharge: 0, total: 0 };
    }
    const { charge: deliveryCharge, freeDelivery } = computeDeliveryCharge(subtotal, delivery);
    const { gstAmount, addOnTop } = computeGst(subtotal, gst);
    const codCharge = isCod && delivery.codEnabled ? (delivery.codCharge || 0) : 0;
    const total = subtotal + deliveryCharge + (addOnTop ? gstAmount : 0) + codCharge - appliedDiscount;
    return { deliveryCharge, freeDelivery, gstAmount, gstAddOnTop: addOnTop, codCharge, total: Math.max(0, total) };
  }, [subtotal, isEmpty, delivery, gst, appliedDiscount, isCod]);

  return {
    subtotal,
    ...pricing,
    discount: appliedDiscount,
    appliedCoupon,
    couponError,
    coupons,
    delivery,
    gst,
    applyCoupon: async (code: string) => {
      const r = await validateCoupon(code, subtotal);
      if (r.valid && r.coupon) {
        setAppliedCoupon(r.coupon);
        setAppliedDiscount(r.discount || 0);
        setCouponError(null);
        return { ok: true };
      }
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(r.reason || 'Invalid coupon');
      return { ok: false, reason: r.reason };
    },
    removeCoupon: () => {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(null);
    },
    setIsCod: () => {}, // payment method drives CoD detection automatically
  };
}
