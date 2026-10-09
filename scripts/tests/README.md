# Server and logic tests

Plain Node scripts. They bundle the real source with esbuild, swap `firebase-admin`
for an in-memory fake (`fake-firebase-admin.mjs`) and mock Meta with a fake `fetch`.
Nothing reaches Firestore, Meta or R2.

Run from the project root:

```
node scripts/tests/announcement.test.mjs .     # broadcast + announcement + STOP opt-out
node scripts/tests/whatsapp-reply.test.mjs .   # send-media, picture templates, big media
node scripts/tests/cart-merge.test.mjs .       # stock-safe add to cart
node scripts/tests/jewellery-offer.test.mjs .  # offer rules + server copy in api/create-order.ts agrees
node scripts/tests/dealer-chats.test.mjs .     # dealer tickets, team permissions, number privacy, webhook routing
```

## Firestore rules suite

`firestore-rules.test.mjs` checks `firestore.rules` on the Firestore emulator
(demo project `demo-rules`, port 8180, so it never reaches the live database):

- every admin action against the owner, one staff login per page key, a
  switched-off login, customers, a signed-in account with no profile and a
  signed-out visitor;
- team logins (own profile, switching off, changing pages), customer accounts,
  checkout stock and coupon writes, orders, delivery, order chat, newsletter,
  reviews, push tokens and video calls;
- known gaps, printed as `GAP` without failing the run. When a rule fix closes
  one it prints `closed`: move that case into the main list.

```
npm run test:rules        # needs a FULL JDK (JAVA_HOME + PATH); a JRE fails
RULES_FILE=path/to/copy.rules npm run test:rules   # try a changed copy first
```

Expect `0 failed`. Every rules change should add or move a case here.

## Browser testing without touching the live project

`src/config/firebase.ts` connects to the Firebase emulators when Vite runs with
`VITE_USE_EMULATORS=1` (dev builds only). Ports are configurable:

```
firebase emulators:start --only auth,firestore     # needs a FULL JDK (a JRE lacks management.dll)
VITE_USE_EMULATORS=1 VITE_AUTH_EMULATOR_PORT=8081 VITE_FIRESTORE_EMULATOR_PORT=8080 npx vite
```

The emulators enforce `firestore.rules`, so browser tests also exercise the rules.
`/api/whatsapp-reply` does not run under Vite; mock it in the browser test.

Build output goes to `scripts/tests/out/` (git-ignored).
