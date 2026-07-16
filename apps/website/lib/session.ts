import "server-only";

import { cookies } from "next/headers";

import { getAdminAuth, getSessionConfiguration } from "./firebase-admin";

export async function getSessionUser(checkRevoked = true) {
  const sessionConfiguration = getSessionConfiguration();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionConfiguration.cookieName)?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    const firebaseAdminAuth = getAdminAuth();
    const token = await firebaseAdminAuth.verifySessionCookie(
      sessionCookie,
      checkRevoked,
    );
    const user = await firebaseAdminAuth.getUser(token.uid);
    return {
      id: user.uid,
      email: user.email ?? null,
      emailVerified: user.emailVerified,
      mfaEnabled: (user.multiFactor?.enrolledFactors.length ?? 0) > 0,
    };
  } catch {
    return null;
  }
}
