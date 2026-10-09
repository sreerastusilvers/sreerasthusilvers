# G1: a "paid" order must be backed by a server-verified payment

Problem: checkout writes the order from the browser with `paymentStatus: 'paid'`,
and `/api/verify-payment` checks the Razorpay signature but writes nothing. Anyone
signed in can write a "paid" order without paying.

## Design

1. **`api/create-order.ts`** stores the server-priced cart lines in the Razorpay
   order's `notes` (`srs_lines_N` = `productId*qty,...`, `srs_line_count`).
   Only Razorpay holds them, and only our key secret can create an order, so they
   are trustworthy. Client notes are whitelisted (`orderNumber`, `userId`), so a
   client can't plant `srs_*` keys. Carts are capped at 30 lines (a rules limit).
2. **`api/verify-payment.ts`** (no new function; the 12-function cap still holds):
   - needs the customer's Firebase ID token and binds the payment to that uid;
   - checks the signature (unchanged), then asks Razorpay for the payment
     (`order_id` must match, status `captured`/`authorized`, amount) and the order
     (`notes` → lines);
   - writes `payments/{razorpayPaymentId}` through the Firestore REST API **as a
     service identity**: a custom token (`uid: razorpay-verifier`, claim
     `paymentServer: true`) is signed locally with the service-account key and
     exchanged for an ID token. This is the same client-side path the browser
     uses, because Admin SDK Firestore calls hit `RESOURCE_EXHAUSTED` on Spark
     (see `api/create-order.ts`);
   - is idempotent: if the record already exists for the same user, it's fine;
   - returns `{ verified, recorded }`. If the record can't be written, checkout
     still gets an order, but as "payment pending, needs review" (step 4).
3. **`firestore.rules`**:
   - `payments/{id}`: create only by the service identity, never updated or
     deleted; readable by its customer and by Orders staff.
   - `orders` create by a customer: `paymentStatus` is `'pending'`, **or** it is
     `'paid'` and backed: the doc id is the `razorpayPaymentId`, the record exists,
     it belongs to the caller, the Razorpay order id matches, `total` is within
     ₹1 of the amount paid, and `items` match the record line by line
     (productId + quantity). The doc id rule means one payment gives one order.
   - The owner's Restore (`isAdmin()`) is unchanged.
4. **Client**:
   - `razorpayService` sends the ID token and passes `recorded` on;
   - `orderService` uses the payment id as the order doc id;
   - the fallback first tries "paid, needs review" (for example, out of stock
     after payment). If the rules refuse that, it writes "payment pending,
     needs review" with the Razorpay ids, so a charged customer always has an
     order;
   - `isPaymentSettled` stops treating any prepaid method as paid: only
     `paymentStatus === 'paid'` counts, or a legacy order with no status.
5. **Tests**:
   - rules suite: G1 closed and moved into the main list, plus the new
     payments and paid-order cases;
   - a new `scripts/tests/payments.test.mjs` runs the real `verify-payment` and
     `create-order` with a fake Razorpay, a fake firebase-admin and a fake
     Firestore REST, with no network;
   - browser test on the emulators with a stubbed Razorpay modal.

## Risks checked
- Without `FIREBASE_ADMIN_SDK_BASE64` in Vercel, no record can be written, so
  every prepaid order lands as "needs review": orders still work, just flagged.
  Owner check listed.
- A web API key restricted by HTTP referrer would block the server's token
  exchange, with the same safe outcome as above.
- The rules cost one extra `get()` (payments) and at most about 200 expressions
  for 30 lines, within Firestore's limits.
- Restore: a binned paid order could be re-created by its customer under the
  same id. That's minor (it was paid), so it's noted, not fixed.
