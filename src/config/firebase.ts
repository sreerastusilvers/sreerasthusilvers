import { FirebaseOptions, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const getRequiredEnv = (key: keyof ImportMetaEnv) => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`[Firebase] Missing required env var: ${key}`);
  }
  return value;
};

export const firebaseConfig: FirebaseOptions = {
  apiKey: getRequiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize a secondary app for creating users without affecting current session
const secondaryApp = initializeApp(firebaseConfig, 'secondary');

// Initialize services
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp); // For creating users without signing out admin
/**
 * `ignoreUndefinedProperties` makes Firestore skip `undefined` fields instead of
 * throwing "Unsupported field value: undefined".
 *
 * Forms build their payloads with `field: value || undefined` for optional
 * inputs, so any empty optional field aborted the whole write - leaving an
 * admin with "Failed to update product" and no clue which field was to blame.
 * Skipping them is the documented behaviour for exactly this pattern.
 *
 * Note this means `undefined` = "leave this field as it is" on an update; to
 * actually clear a stored field, write `null`.
 */
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === '1';
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);

/**
 * Local testing against the Firebase emulators (`firebase emulators:start`),
 * so test accounts and test data never touch the live project. Dev builds only:
 * set VITE_USE_EMULATORS=1 when starting Vite.
 */
if (useEmulators) {
  connectAuthEmulator(auth, `http://127.0.0.1:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 8081}`, { disableWarnings: true });
  connectAuthEmulator(secondaryAuth, `http://127.0.0.1:${import.meta.env.VITE_AUTH_EMULATOR_PORT || 8081}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080));
  console.warn('[Firebase] Using the local emulators (VITE_USE_EMULATORS=1)');
}
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Verify Firebase configuration
if (typeof window !== 'undefined') {
  console.log('[Firebase] Configuration loaded successfully');
  console.log('[Firebase] Project ID:', firebaseConfig.projectId);
  console.log('[Firebase] Auth Domain:', firebaseConfig.authDomain);
}

export default app;
