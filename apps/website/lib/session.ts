import "server-only";

import { cookies } from "next/headers";
import { envaultRedisKey } from "@envault/redis";

import { getAdminFirestore, getSessionConfiguration } from "./firebase-admin";

interface RedisSession {
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export async function getSessionUser(checkRevoked = true) {
  const sessionConfiguration = getSessionConfiguration();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionConfiguration.cookieName)?.value;
  if (!sessionCookie) {
    return null;
  }

  void checkRevoked;
  return getAdminFirestore().get<RedisSession>(
    envaultRedisKey("session", sessionCookie),
  );
}
