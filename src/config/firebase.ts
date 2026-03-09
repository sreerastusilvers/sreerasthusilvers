import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCFXURIC8njn09ahaMDo558Q9Uw5xxmI6M",
  authDomain: "sreerasthusilvers-2d574.firebaseapp.com",
  projectId: "sreerasthusilvers-2d574",
  storageBucket: "sreerasthusilvers-2d574.firebasestorage.app",
  messagingSenderId: "748829519118",
  appId: "1:748829519118:web:7fd09428098720bc6ebb5f",
  measurementId: "G-Q122EBRT4J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize a secondary app for creating users without affecting current session
const secondaryApp = initializeApp(firebaseConfig, 'secondary');

// Initialize services
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp); // For creating users without signing out admin
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Verify Firebase configuration
if (typeof window !== 'undefined') {
  console.log('[Firebase] Configuration loaded successfully');
  console.log('[Firebase] Project ID:', firebaseConfig.projectId);
  console.log('[Firebase] Auth Domain:', firebaseConfig.authDomain);
}

export default app;
