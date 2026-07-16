"use client";

import { getFirebaseClientAuth } from "@envault/firebase/client";

const firebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getClientAuth() {
  if (Object.values(firebaseOptions).some((value) => !value)) {
    throw new Error("Firebase public environment configuration is incomplete.");
  }

  return getFirebaseClientAuth(
    firebaseOptions,
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
      ? "http://127.0.0.1:9099"
      : undefined,
  );
}
