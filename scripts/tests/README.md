# Server and logic tests

Plain Node scripts. They bundle the real source with esbuild, swap `firebase-admin`
for an in-memory fake (`fake-firebase-admin.mjs`) and mock Meta with a fake `fetch`.
Nothing reaches Firestore, Meta or R2.

Run from the project root:

```
node scripts/tests/announcement.test.mjs .     # broadcast + announcement + STOP opt-out
node scripts/tests/whatsapp-reply.test.mjs .   # send-media, picture templates, big media
node scripts/tests/cart-merge.test.mjs .       # stock-safe add to cart
```

Build output goes to `scripts/tests/out/` (git-ignored).
