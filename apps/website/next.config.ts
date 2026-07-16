import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const workspaceRoot = new URL("../..", import.meta.url).pathname;
loadEnvConfig(
  workspaceRoot,
  process.env.NODE_ENV !== "production",
  console,
  true,
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_USE_FIREBASE_EMULATORS:
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS,
    NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION:
      process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION ?? "false",
  },
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  transpilePackages: [
    "@envault/api-client",
    "@envault/api-contract",
    "@envault/config",
    "@envault/firebase",
  ],
};

export default nextConfig;
