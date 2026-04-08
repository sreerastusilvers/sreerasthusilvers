import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcqP9YGYRqgb-Yn7gfHJOPZb0Q39pMrlw",
  authDomain: "sreerasthusilvers-33eb1.firebaseapp.com",
  projectId: "sreerasthusilvers-33eb1",
  storageBucket: "sreerasthusilvers-33eb1.firebasestorage.app",
  messagingSenderId: "308782333600",
  appId: "1:308782333600:web:84ac5c61982529a67f13c5",
  measurementId: "G-CWRLS3Y4QM"
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
