const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with a local service account or ADC
// I can just replace the fallback in PromoSection to map over the hardcoded and add them.
// Wait, I don't have the service account credentials here to run node script easily unless the project is public, but firestore is probably secured.
