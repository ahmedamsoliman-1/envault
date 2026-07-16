import "server-only";

import { parseServerEnvironment } from "@envault/config/server";
import { getFirebaseAdminAuth } from "@envault/firebase/admin";
import { getEnvaultRedis } from "@envault/redis";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

function ensureLocalEnvironmentLoaded() {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    return;
  }

  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
    loadEnvConfig(
      path.resolve(process.cwd(), "../.."),
      process.env.NODE_ENV !== "production",
      console,
      true,
    );
  }
}

export function getSessionConfiguration() {
  ensureLocalEnvironmentLoaded();
  const environment = parseServerEnvironment(process.env);
  return {
    cookieName: environment.SESSION_COOKIE_NAME,
    maxAgeSeconds: environment.SESSION_MAX_AGE_SECONDS,
  };
}

export function getMfaConfiguration() {
  ensureLocalEnvironmentLoaded();
  const environment = parseServerEnvironment(process.env);
  if (!environment.MFA_ENCRYPTION_KEY) {
    throw new Error("MFA_ENCRYPTION_KEY_NOT_CONFIGURED");
  }
  return { encryptionKey: environment.MFA_ENCRYPTION_KEY };
}

export function getAdminAuth() {
  ensureLocalEnvironmentLoaded();
  const environment = parseServerEnvironment(process.env);

  return getFirebaseAdminAuth({
    projectId: environment.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: environment.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: environment.FIREBASE_ADMIN_PRIVATE_KEY,
  });
}

export function getAdminFirestore() {
  ensureLocalEnvironmentLoaded();
  return getEnvaultRedis(process.env);
}
