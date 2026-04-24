import { useEffect, useMemo, useState } from 'react';
import {
  subscribeCouponsSettings,
  subscribeDeliverySettings,
  subscribeGstSettings,
  evaluateCoupon,
  computeDeliveryCharge,
  computeGst,
  DEFAULT_COUPONS,
  DEFAULT_DELIVERY,
  DEFAULT_GST,
  type Coupon,
  type CouponsSettings,
  type DeliverySettings,
  type GstSettings,
} from '@/services/siteSettingsService';

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
  applyCoupon: (code: string) => { ok: boolean; reason?: string };
  removeCoupon: () => void;
  setIsCod: (v: boolean) => void;
}

/**
 * Centralised pricing engine consumed by Checkout / MobileCheckout. All
 * numbers come from admin-managed Firestore documents (siteSettings/*) so
 * editing them in /admin/commerce-settings reflects everywhere instantly.
 */
export function useCheckoutPricing(
  subtotal: number,
  isEmpty: boolean,
  paymentMethod: string
): CheckoutPricing {
  const [coupons, setCoupons] = useState<CouponsSettings>(DEFAULT_COUPONS);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [gst, setGst] = useState<GstSettings>(DEFAULT_GST);

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeCouponsSettings(setCoupons);
    const u2 = subscribeDeliverySettings(setDelivery);
    const u3 = subscribeGstSettings(setGst);
    return () => { u1?.(); u2?.(); u3?.(); };
  }, []);

  // Drop coupon if it becomes invalid (subtotal change, expiry, removal in admin)
  useEffect(() => {
    if (!appliedCoupon) return;
    const r = evaluateCoupon(appliedCoupon.code, subtotal, coupons.coupons);
    if (!r.valid) {
      setAppliedCoupon(null);
      setCouponError(r.reason || null);
    }
  }, [subtotal, coupons.coupons, appliedCoupon]);

  const isCod = paymentMethod?.toLowerCase().includes('cash') || paymentMethod?.toLowerCase().includes('cod');

  const pricing = useMemo(() => {
    if (isEmpty) {
      return { deliveryCharge: 0, freeDelivery: false, gstAmount: 0, gstAddOnTop: false, discount: 0, codCharge: 0, total: 0 };
    }
    const { charge: deliveryCharge, freeDelivery } = computeDeliveryCharge(subtotal, delivery);
    const { gstAmount, addOnTop } = computeGst(subtotal, gst);
    let discount = 0;
    if (appliedCoupon) {
      const r = evaluateCoupon(appliedCoupon.code, subtotal, coupons.coupons);
      if (r.valid) discount = r.discount || 0;
    }
    const codCharge = isCod && delivery.codEnabled ? (delivery.codCharge || 0) : 0;
    const total = subtotal + deliveryCharge + (addOnTop ? gstAmount : 0) + codCharge - discount;
    return { deliveryCharge, freeDelivery, gstAmount, gstAddOnTop: addOnTop, discount, codCharge, total: Math.max(0, total) };
  }, [subtotal, isEmpty, delivery, gst, appliedCoupon, coupons.coupons, isCod]);

  return {
    subtotal,
    ...pricing,
    appliedCoupon,
    couponError,
    coupons: coupons.coupons,
    delivery,
    gst,
    applyCoupon: (code: string) => {
      const r = evaluateCoupon(code, subtotal, coupons.coupons);
      if (r.valid && r.coupon) {
        setAppliedCoupon(r.coupon);
        setCouponError(null);
        return { ok: true };
      }
      setAppliedCoupon(null);
      setCouponError(r.reason || 'Invalid coupon');
      return { ok: false, reason: r.reason };
    },
    removeCoupon: () => { setAppliedCoupon(null); setCouponError(null); },
    setIsCod: () => {}, // payment method drives CoD detection automatically
  };
}
