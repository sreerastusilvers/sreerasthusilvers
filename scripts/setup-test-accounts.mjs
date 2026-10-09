import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// The service-account key must never be in the repo (a copy committed here
// was public on GitHub; see docs/HANDOFF.md). Pass it in the environment.
const sdkBase64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
if (!sdkBase64) throw new Error('Set FIREBASE_ADMIN_SDK_BASE64 to run this script');

const sdk = JSON.parse(Buffer.from(sdkBase64, 'base64').toString());
const app = initializeApp({ credential: cert(sdk) });
const adminAuth = getAuth(app);
const db = getFirestore(app);

const CALLER_UID = '2LVWsqclZxW38GMIOTFysjRuvZI3';
const CALLEE_UID = 'HPOYVqfiZOayuhfOCz7Zpgy9vHX2';

// Verify emails
await adminAuth.updateUser(CALLER_UID, { emailVerified: true });
console.log('caller emailVerified=true');
await adminAuth.updateUser(CALLEE_UID, { emailVerified: true });
console.log('callee emailVerified=true');

// Create Firestore profiles
const now = new Date();
await db.collection('users').doc(CALLER_UID).set({
  uid: CALLER_UID, email: 'testcaller@sreerasthusilvers.test',
  username: 'TestCaller', role: 'user', createdAt: now, updatedAt: now,
}, { merge: true });
console.log('caller Firestore profile OK');

await db.collection('users').doc(CALLEE_UID).set({
  uid: CALLEE_UID, email: 'testcallee@sreerasthusilvers.test',
  username: 'TestCallee', role: 'user', createdAt: now, updatedAt: now,
}, { merge: true });
console.log('callee Firestore profile OK');

console.log('DONE caller=' + CALLER_UID + ' callee=' + CALLEE_UID);
