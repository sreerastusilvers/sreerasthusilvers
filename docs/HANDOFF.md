# Handoff

Last updated: 2026-10-09 (evening)

## 2026-10-09 (evening): G1 fixed (paid orders need a server-recorded payment), multi-item order bug, leaked admin key

Status: committed locally (`114cdb3`, `0714d3d`, `f1ac5ae`). **Not deployed.** Plan: `docs/plans/2026-10-09-g1-paid-orders.md`.

### G1: how a "paid" order is now protected
- `/api/verify-payment` checks the signature as before. It then needs the customer's sign-in token, asks Razorpay for the payment and the order, and writes `payments/{paymentId}`.
    - It writes as a service login (`razorpay-verifier`, custom claim `paymentServer`), made from `FIREBASE_ADMIN_SDK_BASE64`.
- `/api/create-order` stores the priced cart lines in the Razorpay order's notes. Carts are capped at 25 different items.
- **Rules:** a customer's order is either `pending`, or `paid` and matches that record: stored under the payment id (one payment buys one order), same customer, same Razorpay order, total within ₹1, and the same items and quantities.
- **If the server can't record a genuine payment,** the order is still saved as "payment pending, Needs review". The owner's order page shows **Payment confirmed in Razorpay** to mark it paid after checking.
- A prepaid order marked `pending` no longer counts as paid (`isPaymentSettled`).

### Older bug fixed on the way
Every order with 2 or more different items failed its stock transaction (it read after writing). Such orders went to "Needs review" without reducing stock. Fixed in `createOrder`.

### Reviewer findings (one adversarial agent), fixed in `f1ac5ae`
- Customers could create an order already "out for delivery" with themselves as the partner, or already "delivered", then use those update rules to mark it paid. New customer orders must now start `pending` with no delivery fields, and a return request may only touch return fields.
- A payment could buy a second order after the owner deleted the first. A record now backs an order only within 1 hour of payment.
- Currency: always INR (create-order, verify-payment, rules). Payments are auto-captured (`payment_capture: 1`).
- Any order carrying a payment id must be stored under that id, so an "unconfirmed" twin can't be confirmed for a used payment.
- Delivery screens no longer ask for cash on prepaid orders.
- The cart cap is 25 different items (Firestore's rule-size limit).

**Left as is (low):** on paid orders, display fields such as per-item price, subtotal, coupon and offer details are still written by the browser. Total and items are bound to the payment; the rest only affects what is shown.

### Tests
- Rules suite: 340 passed, 0 failed, 0 gaps. The 11 new cases fail on the pre-review rules.
- New `scripts/tests/payments.test.mjs`: 18 passed.
- Other unit tests and `npm run build` pass.
- **Browser, on emulators with a fake Razorpay: 18 of 18 pass.**
    - A normal payment: recorded, order paid, stock reduced.
    - An unconfirmed payment: saved as Needs review.
    - Console tampering: refused.
    - Owner confirms the payment (1440 light, 390 dark).

### SECURITY: the live Firebase admin key is public
`scripts/setup-test-accounts.mjs` held the full service-account key (key id starting `4aeefad8`) since 2026-04-24. The GitHub repo is public. The file now reads the key from the environment, but git history still has it. Anyone can use it to read, change or delete everything in Firebase until it's replaced.

### Owner to-do (in order)
1. **Replace the admin key today.**
    - Google Cloud console → IAM → Service accounts → `firebase-adminsdk-fbsvc` → Keys. Delete the key starting `4aeefad8`, then add a new JSON key.
    - Base64 it and put it in Vercel as `FIREBASE_ADMIN_SDK_BASE64`, then redeploy.
2. Deploy the rules (unchanged step from below): `firebase login --reauth`, then `firebase deploy --only firestore:rules`. **Deploy the code first, then the rules.** With new rules and old code, every prepaid order lands as "Needs review".
3. **After deploy,** place one small real order, then check that Admin → Orders shows it as **Paid** with no "Needs review".
    - If it says "Not confirmed", check that `FIREBASE_ADMIN_SDK_BASE64` is set in Vercel.
    - Also check that the Firebase web API key has no website restriction that blocks the server.

### Notes
- Restoring a deleted paid order from the bin works (owner only). A customer could re-create a binned paid order under the same payment id. This is minor: it was paid.

## 2026-10-09 (later): Firestore rules test suite rebuilt, 11 rule problems fixed

Status: committed locally, **rules not deployed**. `npm run test:rules` gives 298 passed, 0 failed, 1 known gap. One reviewer agent checked the rule changes: no way for staff to escalate. Its two bugs are fixed below (items 9 and 10). `npm run build` passes, and the other unit tests pass (21 + 14 + 8 + 20 + 9). No app code changed: only `firestore.rules`, the tests, and `package.json` (dev dependency `@firebase/rules-unit-testing@5.0.2` and the `test:rules` script).

### The suite (`scripts/tests/firestore-rules.test.mjs`)
- **Admin areas:** 103 actions, each tried as the owner, one staff login per page key, a switched-off login, a login with no pages, a customer, a signed-in account with no profile, and a signed-out visitor.
- **Everything else:** team logins (switching off and changing pages take effect at once), customer accounts, checkout stock and coupon writes, orders, delivery, order chat, the recycle bin and the storefront.
- **Known gaps** print `GAP` without failing the run.
- **Proof the suite catches problems:**
    - It caught three holes planted on purpose: switched-off staff still allowed in, staff giving themselves pages, and customers editing the price.
    - It fails on all 10 fixes below when run against the old rules (`RULES_FILE=<copy> npm run test:rules`).
- **Running it:** needs a full JDK. See `scripts/tests/README.md`.
    - None is installed system-wide. Last time this chat used the JDK left in an earlier chat's temporary scratchpad (`%LOCALAPPDATA%\Temp\claude\...\b8d75ccb-...\scratchpad\jdk-dl\jdk-21.0.12.1+1`), which Windows may clean up.
    - Installing Temurin 21 JDK is a global install, so ask first.

### Rule fixes (owner said yes to all of them)
1. **Recycle bin:** staff could plant an entry such as `users/<id>` with role `admin`. The owner's Restore would then have created an admin.
    - Staff may now only bin a document that exists and that their page lets them delete (`binPage()` in the rules).
2. `siteSettings/adminNotification` (where order alerts go) is owner-only. Content staff could change it before.
3. Customers can no longer set their own wallet balance. This was the 2026-10-05 known issue.
4. A new review must start as `pending`. Before, a customer could publish one as `approved`.
5. Shop-wide `giftCards`: any signed-in user could rewrite a balance. Now only staff with the Gift cards page can.
6. Any signed-in user could list every video call booking and every account-deletion request. Now each person sees only their own.
7. **Dashboard-only staff can read orders.** The owner chose this so the Dashboard page works. They could also see customer names and addresses through the browser console.
8. **Customer details would have broken for the owner after deploy.** It reads `users/{id}/orders`, which had no rule. That path and the wishlist are now readable by the owner and by staff with the Customers page.
9. **Recycle-bin check by document id (reviewer find).** It now looks the document up by its id, piece by piece.
    - Built as one string, the path decoded `+` and `%`.
    - So nobody could have deleted a newsletter subscriber like `name+tag@gmail.com`.
10. **Restore always failed for orders, reviews and video-call bookings** (reviewer find; older bug). Only the customer could create these, so even the owner's Restore was refused. The owner (`isAdmin()`) may now create them.

### Known gap left open (needs server work, not a rule)
- **G1, money:** checkout writes the order from the browser with `paymentStatus: 'paid'`. `/api/verify-payment` checks the Razorpay signature but writes nothing, so a customer who skips payment can create a "paid" order.
    - Fix idea: the server writes the paid order, or writes a `payments/{razorpayPaymentId}` record that the rules require.
    - The `api/` folder is at the 12-function cap, so do it inside an existing function.
    - Until it's fixed, check the payment in the Razorpay dashboard before shipping a prepaid order.

### Browser check (local emulators with the fixed rules): 7 of 7 pass
- The owner opens Customer details (1440 px light, 390 px dark).
- Dashboard-only staff see the order figures (1440 px dark, 390 px light).
- Products staff delete a product, and it lands in the Recycle bin as "deleted by Prod".
- Planting a `users/...` entry in the bin is refused.

### Found while testing, not fixed (older bugs, not caused by the rules)
- **Customer details always shows "Orders 0" and ₹0.** The Customers list also always shows 0. Both read `users/{id}/orders`, which nothing writes; real orders live in `orders` with `userId`.
    - Fix: query `orders` where `userId == id`.
    - The rules would then need to let Customers staff read orders (a decision for the owner).
- **The Dashboard shows buttons a Dashboard-only login can't use:** Add Product, Save silver rate, Upload Media and View Orders. They fail when used.

### Minor, left as is
- **Bin entry wording:** a staff member's bin entry can claim any `label` or `deletedByName`, for example "removed by Owner". The rules check only `deletedByUid`, and the bin screen shows the name.
- **Video calls:** video-call staff can bin any call. This is harmless: a Restore needs the owner to be the caller.

### Owner to-do
1. Deploy the rules: `firebase login --reauth`, then `firebase deploy --only firestore:rules`.
2. The rest of the to-do list in the entry below is unchanged.

### Next steps
1. ~~Fix G1~~ Done 2026-10-09 (evening), see the entry above.
2. Customer details and Customers list order counts (see "Found while testing").

## 2026-10-09: jewellery offer, team logins, activity log, recycle bin, dealer chats, WhatsApp redesign, install as app

Status: done and committed locally (not pushed, not deployed). `npm run build` passes. The type-check shows the same 13 old errors, none in new code. `api/` still has 12 files. Unit tests: 21 + 14 + 8 + 20 + 9 pass (`scripts/tests/README.md`). Browser checks: 87 pass, at 390 px and 1440 px in light and dark. They ran on the local Firebase **emulators** with the new rules; no live data was touched, and `/api/whatsapp-reply` was mocked, so no real WhatsApp messages were sent.

### 1. Jewellery offer
- Buy jewellery above a tier and one product in the same order is free up to the tier's credit: ≥ ₹25,000 → ₹7,000; ≥ ₹50,000 → ₹15,000; ≥ ₹1,00,000 → ₹30,000.
- If the free item costs more than the credit, the credit comes off and the customer pays the rest.
- **The free unit never counts towards its own threshold.** For example, a lone ₹30,000 ring can't make itself free.
- **Settings:** Admin → Commerce → **Offers** (`siteSettings/jewelleryOffer`).
    - On/off (**default off**), tiers, which categories count (Jewellery), and dates.
    - "Allow with coupons" (default off: a coupon switches the offer off for that order). Terms text.
    - A "Try it" calculator.
- **Logic:** `src/lib/jewelleryOffer.ts`. An exact copy sits in `api/create-order.ts`, so the server charges the same amount; a test checks the two agree on 2,000 random carts.
- **Shoppers see it on:**
    - the cart drawer, mobile cart and checkout: progress bar, "free item unlocked", a picker for which item is free, and a "Free item (jewellery offer)" bill row;
    - jewellery product pages: a list of the tiers.
- **Orders store** `offerDiscount`, `offerGiftName`, `offerCredit` and `offerQualifyingSpend`; `discount` = coupon + offer. Admin order details and the invoice PDF show the offer line.

### 2. Team logins (Admin → Team, owner only)
- **Roles:** a team member is `users/{uid}` with `role: 'staff'`, `staffRole: 'staff' | 'website_manager'`, `permissions: [...]` and `isActive`. The pages are listed in `src/lib/permissions.ts`.
- **Enforced in four places:**
    - the sidebar and `AdminRoute` (redirect to their first page);
    - `firestore.rules` (`can('<page>')`);
    - `api/whatsapp-reply.ts` (`ACTION_PERMISSIONS`);
    - `api/media.ts` (uploads for product and content managers).
- **Owner-only pages:** Team, Manufacturers, Activity, Recycle bin, Settings.
- **Switching a login off or changing its pages** takes effect immediately; the open session is watched live.
- **Removing a login** makes it an ordinary customer account. Deleting the sign-in itself needs the Admin SDK; not done.

### 3. Activity log and recycle bin (owner only)
- **How it works:** `vite.config.ts` aliases `firebase/firestore` to `src/lib/audit/firestore.ts`.
    - Inside `/admin`, every write by the owner or staff is logged to `activityLog`: who, what and which fields, never the values.
    - Every delete is first copied to `recycleBin`. That covers all 57 delete call sites without changing them.
    - Skipped as bookkeeping: login counters on your own profile, chat read receipts, carts and tokens.
- **Restore** puts the document back exactly as it was. **Delete forever** removes it; for products, it also frees the photos (deleting a product no longer deletes its photos straight away).
- **Delete dialogs** now say the item goes to the Recycle bin.

### 4. Dealer (manufacturer) chats
- **Data:**
    - `dealers/{id}`: the display name plus the chat summary (staff can read it).
    - `dealerPrivate/{id}`: the number, the real name and the dealer's WhatsApp profile name (owner and server only).
    - `dealers/{id}/messages`, `dealerTickets` (T-0001…) and `counters/dealerTickets`.
- **Owner:** Admin → **Manufacturers**. Add a dealer (display name, real name, number). **Create the template** once (`dealer_enquiry`, UTILITY, saved in `siteSettings/dealerChat`).
- **Staff:** Admin → **Dealer Chats**.
    - **New ticket** sends the template, which asks the dealer to reply. The 24 h window isn't mentioned to the dealer.
    - Once the dealer replies, staff chat freely: text, photos and documents up to 3 MB, each tagged to a ticket.
    - Tickets can be closed and reopened. Staff only ever send a `dealerId`; the server looks up the number.
- **Webhook:** a reply from a listed number goes to that dealer's chat, never the customer inbox. Delivery ticks work for dealer messages.
- **Calling:** not built. Meta's Calling API needs a daily messaging limit of at least 2,000 unique recipients, which this number almost certainly doesn't have yet. See `docs/WHATSAPP_SETUP.md`, Step 9c.

### 5. WhatsApp look (customer inbox and dealer chats)
- **Shared kit:** `src/components/wa/` (WaKit, `wa.css`, emoji picker).
- **Desktop** follows WhatsApp Web: list pane, grey headers, doodle wallpaper (our own drawing, not WhatsApp's), bubbles with tails, ticks, day chips, pill composer, and an intro screen.
- **Phones** follow the Android app: the chat opens full screen, the back gesture closes it, a round green send button and a "New ticket" floating button.
- **Every inbox feature is kept:** filters, search, assign, resolve, notes, quick replies, templates, attachments, the 24 h window and load-more.

### 6. Install as app
- `public/manifest.webmanifest` plus icons, and `src/lib/pwaInstall.ts`.
- The "Install app" card shows **only on /account**: a button when the browser offers install, steps on iPhone Safari, and hidden once installed.

### Other fixes
- Staff accounts were counted as "customers" by announcements and broadcasts; now excluded.
- A dealer ticket ending in "." produced ".." in the WhatsApp text; fixed.

### Owner to-do (in order)
1. **Deploy the Firestore rules.** Production still runs open test-mode rules, so staff limits are only enforced by the screens and the API until this is done: `firebase login --reauth`, then `firebase deploy --only firestore:rules`.
2. Deploy the site (push, or Vercel), then Promote the deployment if production is pinned (see the 2026-10-05 note).
3. Admin → Commerce → Offers: check the tiers and switch the offer **on**.
4. Admin → Manufacturers: **Create the template**, wait for "ready", then add the manufacturers.
5. Admin → Team: create staff logins.
6. Meta: the app must be **Published** for incoming dealer replies to arrive (same as the customer inbox; 2026-10-05 to-do 1b).

### Not verified
- **Real Meta and the real payment path:**
    - the dealer template approval and its wording;
    - real dealer replies arriving through the webhook (covered by unit tests with a fake Firestore);
    - a real Razorpay payment with the offer applied (server pricing is unit-tested; the browser test stopped before payment so no real order was created).
- **Install:** a real install on Android or iPhone (the prompt was simulated).
- **Rules:** no 50-case rules suite was re-run (since rebuilt; see the 2026-10-09 (later) entry). The new rules were exercised by the browser tests (owner, staff and website-manager reads and writes all worked; owner-only pages were refused).

### Known issues, not fixed
- The 13 old type errors.
- Activity shows the latest 300 entries; the bin shows 500. Neither pages further yet.
- `api/create-order.ts` carries a copy of the offer logic (needed by Vercel's setup). Edit both together; the test catches drift.

### Next steps
1. The owner to-do above.
2. ~~Rebuild the Firestore rules suite~~: done in the 2026-10-09 (later) entry above.

## 2026-10-05 (late night): home rows now drift continuously, alternating direction

Status: done, not committed. `npm run build` passes. The type-check shows 13 errors, all old, none in the changed files. Browser-checked with Playwright on the dev server at 390 px and 1440 px, light and dark.

- **Owner's complaint:** the home product rows "don't scroll / feel static".
    - **Root cause:** the old autoplay waited 3.5 s, hopped one card, then rested again.
    - Every pause restarted that 3.5 s wait, including going off screen while the page was scrolled and a touch (held for 2.5 s after lifting).
    - So in real use the rows looked still.
- **Now (`src/hooks/useAutoScroll.ts`):** a continuous drift at 40 px/s.
    - It eases in over 0.45 s and loops seamlessly through the duplicated cards.
    - **Mouse:** it stops the instant the mouse is over a row and starts again the instant it leaves.
    - **Finger:** it stops while touched and starts again about 0.3 s after the swipe settles.
    - The arrows still page by a card and then rest 1.6 s.
    - With reduced motion it stays still, as before.
- **Smoothness:** Chrome rounds `scrollLeft` to whole pixels, so the whole pixels go to `scrollLeft` and the leftover fraction goes to a `transform` on an inner track.
    - Measured: an even 0.667 px per frame at 60 fps, no stalled frames, no jump at the loop point.
    - So every row's cards are now wrapped in one inner `flex w-max gap-*` div (TopDeals ×2, BestSellers mobile, TrendProducts mobile, TrendProductSection, PromoSection, YouTubeShowcase). Keep that wrapper if you edit these rows.
    - Snap and smooth scrolling are switched off on a row while it autoplays.
- **Directions alternate (owner's ask: first row right to left):**

  | Row | Direction |
  |---|---|
  | TopDeals | R→L |
  | BestSellers | L→R |
  | TrendProducts (New Arrivals) | R→L |
  | TrendProductSection (Trending) | L→R |
  | PromoSection (Collections) | R→L |
  | YouTubeShowcase | L→R |

  Desktop shows the first three rows.
- The TopDeals desktop row now renders its cards twice, so it loops seamlessly.
- `useAutoplayGate.hold(ms?)` now takes an optional duration.
- **Not changed:**
    - FeaturedSection ("Editor's Picks"), a paged grid, not a row.
    - HeroBanner and Testimonials, which have their own autoplay.
- **Not verified:** real iOS Safari momentum scrolling and a 120 Hz phone. Check on a real phone after deploy.
- Section 1 of the "evening" entry below (one card every 3.5 s) is replaced by this.

## 2026-10-05 (late): removed 89 unused files

Status: done. The owner approved it. The 89 files in `docs/UNUSED_FILES.txt` were removed with `git rm`; all were tracked, none were missing. `npm run build` passes. The type-check (`npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 5.0`) now shows 13 errors, down from 20, and none are "cannot find module". Without the override flag, tsc stops at `ignoreDeprecations: "6.0"` in `tsconfig.app.json` line 25. No browser check was done: none of the files were imported from `src/main.tsx`, and the build confirms that.

## 2026-10-05 (night): announcements, product-page claims, known-issues list, leaked token

Status: done. `npm run build` passes and `api/` still has 12 files. The type-check shows the same 20 old errors as before, none in changed files. Tests pass: `scripts/tests/` has 21 + 14 + 8 cases (see its README). Playwright checks pass 25/25 at 390 px and 1440 px, light and dark; Meta, `/api/broadcast` and R2 were mocked. Committed locally, not pushed. Firestore rules not changed.

### 1. Marketing → Announcement (new first tab)
- **Files:** `src/components/admin/marketing/AnnouncementComposer.tsx` and `announcement.ts`.
- **How it works:** one WhatsApp template, `store_announcement`.
    - The text is "Hello {{1}}, … update from Sreerasthu Silvers: {{2}} …", with the footer "Reply STOP to stop these updates".
    - {{1}} is the customer's first name, filled per customer; {{2}} is whatever the admin types.
- **Template setup:** a "Create announcement template" button and a "Check status with Meta" button. A rejected template is resubmitted as `_v2`, `_v3`, and so on.
- **Audience:** all customers, or chosen customers from a searchable checkbox list.
- **Channels:** WhatsApp and/or website notification.
- **Before sending:**
    - A live preview.
    - A reach count: no number, replied STOP, or a duplicate number.
    - A confirm dialog.
- **`api/broadcast.ts` fixes:**
    - "Customers" missed every shopper: signup saves `role: 'user'` and the filter wanted `'customer'`. It now means everyone except admin and delivery accounts.
    - It now uses `whatsappNumber` first and adds 91 to bare 10-digit numbers.
    - It sends once per number.
    - It skips numbers that opted out.
    - It folds line breaks, which Meta rejects (error 132018).
    - It sends 8 messages at a time, with `maxDuration` 60.
    - It logs each sent message into the customer's inbox thread (existing threads are bumped; no empty threads are created).
- **STOP/START:** `api/whatsapp-webhook.ts` sets `whatsappThreads/{phone}.marketingOptOut`.
- **The Custom tab's picker** had the same role bug (fixed). Its search icon overlapped the placeholder (fixed).

### 2. Product-page claims (owner asked to replace them)
- **ProductDetail:** "Free Shipping / 2 Year Warranty / Easy Returns" are gone. The strip now shows:
    - the product's own purity ("92.5 Sterling Silver" or "99.9% Pure Silver", hidden when the product has none);
    - "Secure Checkout";
    - "See It on Video Call".
- **Home:** `FreeShippingBand` said "Free Shipping Over ₹20,000" and `FeatureIcons` said "Free shipping over ₹10,000". Both now use the 92.5 silver, secure checkout, video call and WhatsApp claims instead.
- **Checkout:** "7-Day Easy Returns" was kept. It matches the site's own refund policy page (7 days).

### 3. Known issues list from the evening entry
- **`/wallet`:** now a redirect to `/purchase-summary`. WalletPage was deliberately **not** routed: checkout can't spend a wallet balance, and its "redeem gift card" would use up the card for nothing.
- **2FA card (and nearby Security panels) in dark mode:** fixed.
- **`/products`:** lists the whole catalogue ("All Products"). `?tag=` still filters.
- **CartContext:** the add is saved in a Firestore transaction that re-checks stock against the saved quantity (`src/contexts/cartMerge.ts`). The local-storage fallback saves the latest items (`itemsRef`).
- **ProductCard quantity buttons:** a 44 px hit area through `before:-inset-2` (still 28 px visually), plus focus rings.
- **QuickView:** uses the live silver-rate price, the same as ProductCard, for both the price shown and the price added to the cart.
- **WhatsApp:**
    - **Picture-header templates:** a "Text / Picture" switch in Create new. The picture goes to R2 (category `media`, ≤500 KB JPEG), then the server sends it to Meta as the review sample (resumable upload; app ID from `WHATSAPP_APP_ID` or `GET /app`). The picture is saved as `headerImageUrl` and attached to every send (inbox, Custom, broadcast). Library → "Set picture" covers templates made in WhatsApp Manager. The server only fetches pictures from `R2_PUBLIC_URL`.
    - **Team media:** a paperclip in Reply mode (also paste). Photos are re-encoded to JPEG ≤3 MB; documents (PDF, Office, txt) up to 3 MB. New action `send-media`, which uploads to Meta's `/media` and then sends.
    - **Large media:** the `media` action serves 3.5 MB slices, which the admin page joins. The limit is now 25 MB.
    - **Inbox:** "Load older conversations" adds 300 more each time.
- **About 89 unused files:** deleted on 2026-10-05 (see the entry above).

### 4. Security: a WhatsApp token was committed
- `scripts/test-templates.mjs` had a hardcoded token fallback, committed since 2026-04-28 and pushed to GitHub. The fallback is removed. Checked 2026-10-05: the token belongs to the agency's **"Dream Team Posting"** app and a different phone number, **not** the store's (the store uses app `ssmessages` and the "Sreerasthu Silvers" number). It **still works**, so revoke it in the Dream Team business: Settings → System users → Revoke tokens. The store's token doesn't need replacing.

### Owner to-do
1. **Meta (Dream Team business, not the store):** revoke the leaked "Dream Team Posting" system-user token (see section 4).
1b. **Meta app `ssmessages` is Unpublished.** Sending already works. Publishing (privacy URL `https://www.sreerasthusilvers.com/privacy-policy`) is needed for incoming messages, ticks and STOP. Webhook callback: `https://www.sreerasthusilvers.com/api/whatsapp-webhook`. Use `www`, because the bare domain 307-redirects.
2. **Vercel and Meta setup:** the setup guide steps (env vars, webhook, Live mode). `WHATSAPP_APP_ID` is optional; it's only needed if a picture template says it can't find the app ID.
3. **Announcement:** Admin → Marketing → Announcement → "Create announcement template" once, then wait for Approved.
4. **Firestore rules:** still not deployed (from earlier entries).
5. **[NEED] Confirm with the client:**
    - Is all their silver jewellery 92.5? The home band and feature card now say so; the owner suggested it.
    - The "The Iconic Box … signature packaging" claim on the home page.
    - "In-store … appointments" on the home page.
    - One product is named "Silver Clad Photo Frame" but its purity says "999 pure silver".
    - The home collections show "NECKLACE / GOLD" and "DIAMOND NECKLACE / PURE DIAMOND" with no pictures. They look like placeholders on a silver store.

### Live check (2026-10-05, 14:06 UTC)
- WhatsApp is connected end to end on production:
    - all six env vars are set;
    - the webhook is verified;
    - a "Hi" from the owner's phone landed in `whatsappThreads`.
- **Vercel gotcha:** production was pinned (after an Instant Rollback), so the Redeploys built but did not go live until one was **Promoted**. If env changes don't show up on the live site, check that the newest deployment has the blue "Production" label.
- The announcement template has not been created yet (the owner does this from the admin).

### Not verified
- Real Meta was never called:
    - the resumable upload and `GET /app` for picture templates;
    - multipart `/media` uploads;
    - whether Meta's media CDN honours `Range` (the code works either way; tests cover both);
    - approval of the announcement template wording.
- A broadcast to a large list (8 at a time, 60 s limit; roughly 1,000+ messages should fit).

### Known issues, not fixed
- The 20 old TypeScript errors (unchanged).
- Firestore rules let a customer edit their own `users/{uid}/wallets` balance. Nothing uses wallets now; lock it down to admin-only when rules are next deployed (needs the emulator suite).
- Inbox: the sticky "Yesterday" day label can overlap a note bubble while scrolling.
- An admin choosing customers loads every user document (fine at today's ~30 customers; needs paging at thousands).

## 2026-10-05 (evening): home autoplay, account sidebar + photo, cart confirmation, image viewer, WhatsApp templates + team inbox

Status: done. `npm run build` passes, and `api/` still has 12 files. Each part was browser-tested with Playwright at 390 px and 1440 px, in light and dark mode. Committed locally, not pushed. Firestore rules were changed but **not deployed**.

### 1. Home carousels and reels scroll by themselves
- `src/hooks/useAutoplayGate.ts` (new) and `src/hooks/useAutoScroll.ts` (rewritten).
- Every 3.5 s a row glides forward by one card.
- **Pauses** on hover, touch (resumes 2.5 s after the finger lifts), a manual swipe or scroll, keyboard focus, being off screen, or a hidden tab. Never runs under reduced motion.
- **Mobile reels** (`YouTubeShowcase`): hold still while a video plays or the popup is open. Videos never autoplay sound.
- **Used in:** TopDeals, BestSellers, TrendProducts, TrendProductSection, PromoSection, TestimonialsCarousel. HeroBanner keeps its own autoplay but now follows the same pause rules.
- **Root cause of the old stutter:** `index.css` sets `scroll-behavior: smooth` on `.overflow-x-auto`, which fought the old per-frame scroll.

### 2. Account: left sidebar and profile photo
- **New in `src/components/account/`:** AccountShell, AccountSidebar, UserAvatar, useAccountIdentity, useProfilePhoto.
- **Sidebar:** desktop only, from 1024 px up. Mobile keeps its old layout.
- **Photo:** uses the uploaded photo, then the Google photo, then initials.
  - Uploads are 400 px WebP, sent through `api/media.ts` (folder `avatars`, per user).
  - The URL is saved in `users/{uid}.avatar`.
  - Replacing or removing a photo deletes the old file.
- **Fixed:** Google sign-in used to overwrite an uploaded photo on every login.
- **`/profile` now redirects to `/account`:** the old page showed another client's branding ("Venkat Plus").

### 3. Add-to-cart confirmation
- **New in `src/components/cart/`:**
  - `cartFeedback.ts` and `CartConfirmation.tsx`: a panel top-right on desktop, a bottom sheet on phones. It shows the subtotal and has View cart / Checkout. It closes itself after 4 s.
  - Every add and every refusal in `CartContext` goes through it.
- The add buttons show "Added ✓".
- **`src/hooks/use-toast.ts` drops non-error "Added to cart" toasts.** About 70 older files, most of them unrouted pages, still fire their own toast. This filter stops shoppers seeing two confirmations.

### 4. Product image viewer (cropping fixed)
- **Root cause:** the main photo used `object-cover` in an `aspect-square` frame. It is now `object-contain`.
- **New full-screen viewer** (`src/components/ProductImageViewer.tsx`): zoom by pinch, wheel, double-tap or keys, pan, swipe and arrows. Escape closes it and focus is kept inside while open.
- **Product page fixes:**
  - It no longer shows a made-up description when a product has none.
  - The mobile Buy bar uses the live price.
  - Buy now no longer adds the item twice.
  - The quantity can't go above stock.
- **QuickView:** the wishlist button works, and the dead Compare button is gone.
- **Wishlist:** "Add to cart" now really adds the item.

### 5–6. WhatsApp: templates via the Meta API, team inbox, setup guide
- **`api/whatsapp-reply.ts`** is now an action dispatcher. Its actions are:
  - `send` (the default)
  - `mark-read`
  - `media`
  - `templates-list` (sync)
  - `templates-create`
  - `templates-delete`
  - `config-status` (returns only true/false for each setting)
- **`api/whatsapp-webhook.ts`:**
  - Sent, delivered and read ticks, and failure reasons.
  - Labels for media, location and contacts.
  - A resolved thread reopens when the customer writes again.
- **Admin → Marketing → Templates:**
  - A create form with a live preview, synced with Meta, status badges, and delete.
  - Manual entry is still available.
- **Admin → WhatsApp:**
  - Filters, search, assign, open/resolved, internal notes and quick replies.
  - A 24 h window countdown; it switches to template mode automatically when the window closes.
  - A setup-status checklist and an unread badge in the sidebar.
  - `?demo=1` shows demo data in dev only.
- **Rules:** new admin-only collection `whatsappSnippets`. **Not deployed.**
- **Owner guide:** `docs/WHATSAPP_SETUP.md`. New env var: `WHATSAPP_WABA_ID`.

### Owner to-do
- Follow `docs/WHATSAPP_SETUP.md`: Vercel env vars (including the new `WHATSAPP_WABA_ID`), the webhook, then redeploy.
- Deploy Firestore rules: `firebase login --reauth`, then `firebase deploy --only firestore:rules`. This is still pending from before, and now also includes `whatsappSnippets`.
- **[NEED] Confirm these product-page claims are true:** "Free Shipping", "2 Year Warranty", "Easy Returns".

### Not verified
- Meta was never called; tests used a mocked Graph API. The guide's Meta dashboard steps may name buttons slightly differently.
- Touch auto-scroll timing was tested in Chromium only. Check it on a real iPhone.

### Known issues, not fixed
- `WalletPage.tsx` isn't routed: `/wallet` shows PurchaseSummary.
- The 2FA card on `SecurityPage` stays light in dark mode.
- `/products` shows "Category not found".
- About 55 unrouted page files with old cart code. Candidates for deletion: `src/pages/Shop*`, `Silver*`, `categories/*`, `ProductDetailSection.tsx`, `CartExamples.tsx`.
- **CartContext:**
  - Adds made before the saved cart loads check stock against an empty cart.
  - The local-storage fallback saves the cart from before the add.
- The ProductCard quantity buttons are 28 px, below the 44 px minimum.
- The QuickView price isn't live.
- WhatsApp:
  - Template headers are text only.
  - Media sent by the team isn't supported.
  - Media over 4 MB can't be previewed.
  - The inbox shows at most 300 threads.

## 2026-10-05 (later): desktop category dropdown keyboard fixes

Status: done. Build passes. Tested with Playwright at 1440 px in light and dark mode (26/26 checks). Committed locally, not pushed.

- `src/components/CategoryIconNav.tsx`:
  - **Tab order:** Tab on an open tab now goes into its dropdown items, and Tab on the last item goes to the next tab. Shift+Tab goes back the same way. After the last tab, the browser's normal order takes over.
  - **Blur:** the dropdown closes when focus leaves both the tab and its dropdown. This includes tabbing out and clicking elsewhere.
  - **Escape** inside the dropdown closes it and puts focus back on its tab, without reopening it.
  - The `role="menu"`/`menuitem` roles are gone, because they promise arrow-key navigation that the dropdown never had. It now follows the disclosure pattern: `aria-expanded` plus `aria-controls` pointing at the dropdown `id`.
  - Dropdown items show an inset focus ring (`ring-ring`) in place of the faint background they had before.
- Mouse hover and click on items behave as before (the test checks that a click still opens `/category/jewellery?sub=womens`).
- Not covered: Safari, where clicking a button doesn't focus it. That case is handled with a `:hover` guard but was not tested.

## 2026-10-05 — AI prompts for non-jewellery, image compressor, nav dropdown, mobile checkout

Status: done, build passes, browser-tested (Playwright, 390 px and 1440 px, light and dark). Reviewed and **committed locally** (not pushed).

### What changed
- **AI Prompts** (`src/services/geminiService.ts`, `src/pages/admin/AdminImagePrompts.tsx`)
  - New "What are you shooting?" picker: Jewellery / Furniture / Articles & Decor / Gifting / Pooja Items / Wedding.
  - Jewellery keeps the old model-wears-it prompts.
  - Every other type uses new lifestyle "in use" prompts. Each type has its own pools of scenes, people/actions and studio sets (`KIND_PROFILES`), plus `USE_CASE_RULE`: no "holding it up to the camera", true real-world scale, correct placement.
  - Optional "What is it and how big?" note, used for scene planning and scale.
  - Logo rule rewritten: one small transparent corner watermark at about 10% of the image width, never a box or banner. It now appears once per prompt (it used to be duplicated).
  - Fixed the earring "side profile" instruction, which contradicted the visibility rule.
- **Image Compressor**: new admin page at `/admin/image-compressor` (`src/lib/imageCompressor.ts`, `src/pages/admin/AdminImageCompressor.tsx`).
  - Binary-searches the WebP/JPG quality per resolution. Caps at 2400 px for 500 KB and 3200 px for 1 MB banners.
  - Downloads a ZIP via `fflate` (new dependency).
  - The Product form links to it.
- **Desktop category dropdown** (`src/components/CategoryIconNav.tsx`): the menu was clipped by the row's `overflow-x-auto`. It now renders once as a child of the sticky `<nav>`, lined up under the hovered tab, and closes on Escape or sideways scroll.
- **Mobile checkout** (`src/pages/Checkout.tsx`, `MobileCheckout`)
  - Payment is now step 3 on the same page; the old full-screen overlay is gone.
  - Step 2 shows a "Continue to Payment" button, and the single "Slide to Pay" is on step 3.
  - Step 3 shows the delivery address, every item and the full bill.
  - The Bill Summary now includes the coupon-discount row, which was missing on step 2.
- **Prices**: `src/lib/formatPrice.ts` (`formatAmountINR`) gives Indian grouping (₹ 2,35,100.00) in checkout, mobile cart, account and admin orders.

### Review (2026-10-05)
- Fixed: in mobile checkout, `handlePlaceOrder`'s early exits (no address, empty cart) now reset the Slide to Pay control. Before, it stayed in its "done" state with no way to retry. This is a logic-only change; there is no visual change.
- No secrets in the diff. Type check is clean for every changed file, and lint is clean apart from older warnings.
- Minor follow-ups: both dropdown keyboard issues are now fixed (see the entry above).

### Not verified
- No real Gemini call was made. The assembled prompts were checked by intercepting the API request. The first real generations per product type should be reviewed by the team.

### Pre-existing, not touched
- `npx tsc` fails on `ignoreDeprecations: "6.0"` in `tsconfig.app.json` with TS 5.9, and there are older type errors in unrelated files (VideoCallRequestModal, *Collections pages, invoiceService, videoCallService, DeliveryDashboard).
