import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig: FirebaseOptions = {
  ...requiredFirebaseConfig,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const REQUIRED_KEYS = Object.entries(requiredFirebaseConfig).filter(([, value]) => !value);

export const hasFirebaseConfig = REQUIRED_KEYS.length === 0;

const app = hasFirebaseConfig
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
export const firestoreDb = app ? getFirestore(app) : null;

export function assertFirebaseConfigured(): void {
  if (!hasFirebaseConfig || !firebaseAuth || !firestoreDb) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* variables to continue.",
    );
  }
}

export function getMissingFirebaseKeys(): string[] {
  return REQUIRED_KEYS.map(([key]) => key);
}
