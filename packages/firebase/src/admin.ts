import "server-only";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export interface FirebaseAdminOptions {
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
}

export function getFirebaseAdminApp(options: FirebaseAdminOptions) {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const credential =
    options.clientEmail && options.privateKey
      ? cert({
          projectId: options.projectId,
          clientEmail: options.clientEmail,
          privateKey: options.privateKey,
        })
      : applicationDefault();

  return initializeApp({ credential, projectId: options.projectId });
}

export function getFirebaseAdminAuth(options: FirebaseAdminOptions) {
  return getAuth(getFirebaseAdminApp(options));
}

export function getFirebaseAdminFirestore(options: FirebaseAdminOptions) {
  return getFirestore(getFirebaseAdminApp(options));
}
