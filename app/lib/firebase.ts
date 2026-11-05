import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const hasRequiredConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;

if (hasRequiredConfig) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestore = getFirestore(firebaseApp);
}

/** Firestore is null until the Firebase web-app config is supplied. */
export const db = firestore;
export const isFirebaseConfigured = hasRequiredConfig;

export function getFirebaseStatus() {
  if (!isFirebaseConfigured || !db) {
    return { label: 'Demo mode: Firebase not configured', enabled: false };
  }

  return { label: 'Firebase initialized (Firestore)', enabled: true };
}
