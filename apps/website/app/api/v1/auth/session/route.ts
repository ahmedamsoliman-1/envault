import { sessionExchangeRequestSchema } from "@keephq/api-contract";
import { keepRedisKey } from "@keephq/redis";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import {
  getAdminAuth,
  getAdminFirestore,
  getMfaConfiguration,
  getSessionConfiguration,
} from "@/lib/firebase-admin";
import { MfaRepository } from "@/lib/mfa-repository";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

interface TrustedMfaDevice {
  userId: string;
  trustVersion: string;
  createdAt: string;
}

export async function GET() {
  const requestId = crypto.randomUUID();
  const user = await getSessionUser();

  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  const sessionConfiguration = getSessionConfiguration();
  return successResponse(
    {
      user,
      expiresAt: new Date(
        Date.now() + sessionConfiguration.maxAgeSeconds * 1_000,
      ).toISOString(),
    },
    requestId,
  );
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }

  const result = sessionExchangeRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!result.success) {
    return invalidRequestResponse(requestId);
  }

  try {
    const firebaseAdminAuth = getAdminAuth();
    const sessionConfiguration = getSessionConfiguration();
    const decodedToken = await firebaseAdminAuth.verifyIdToken(
      result.data.idToken,
      true,
    );
    let passkeyAuthenticated = false;
    if (result.data.passkeyProof) {
      const proofKey = keepRedisKey("passkey-proof", result.data.passkeyProof);
      const proof = await getAdminFirestore().get<{ userId: string }>(proofKey);
      await getAdminFirestore().del(proofKey);
      passkeyAuthenticated = proof?.userId === decodedToken.uid;
    }
    let customMfaEnabled = false;
    let mfaTrustVersion: string | null = null;
    let trustedDeviceCookieName = "envault_mfa_trust";
    let trustedDeviceMaxAgeSeconds = 2_592_000;
    let shouldRememberDevice = false;
    try {
      const redis = getAdminFirestore();
      let encryptionKey = "";
      try {
        const mfaConfiguration = getMfaConfiguration();
        encryptionKey = mfaConfiguration.encryptionKey;
        trustedDeviceCookieName = mfaConfiguration.trustedDeviceCookieName;
        trustedDeviceMaxAgeSeconds =
          mfaConfiguration.trustedDeviceMaxAgeSeconds;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "MFA_ENCRYPTION_KEY_NOT_CONFIGURED"
        ) {
          throw error;
        }
      }
      const mfaRepository = new MfaRepository(redis, encryptionKey);
      const mfaStatus = await mfaRepository.trustStatus(decodedToken.uid);
      customMfaEnabled = mfaStatus.enabled;
      mfaTrustVersion = mfaStatus.trustVersion;
      if (customMfaEnabled && !encryptionKey) {
        return errorResponse(
          {
            code: "INTERNAL_ERROR",
            message: "MFA is enabled but the server key is unavailable.",
          },
          requestId,
          503,
        );
      }
      const trustedDeviceId = request.cookies.get(
        trustedDeviceCookieName,
      )?.value;
      const trustedDevice = trustedDeviceId
        ? await redis.get<TrustedMfaDevice>(
            keepRedisKey("mfa-trusted-device", trustedDeviceId),
          )
        : null;
      const deviceIsTrusted =
        passkeyAuthenticated ||
        (trustedDevice?.userId === decodedToken.uid &&
          trustedDevice.trustVersion === mfaTrustVersion);

      if (customMfaEnabled && !deviceIsTrusted && !result.data.mfaCode) {
        return errorResponse(
          {
            code: "MFA_REQUIRED",
            message: "Authenticator verification is required.",
          },
          requestId,
          401,
        );
      }
      if (
        customMfaEnabled &&
        !deviceIsTrusted &&
        result.data.mfaCode &&
        !(await mfaRepository.verify(decodedToken.uid, result.data.mfaCode))
      ) {
        return errorResponse(
          { code: "INVALID_MFA_CODE", message: "The code is invalid." },
          requestId,
          401,
        );
      }
      shouldRememberDevice =
        customMfaEnabled &&
        !deviceIsTrusted &&
        Boolean(result.data.mfaCode) &&
        result.data.rememberDevice &&
        Boolean(mfaTrustVersion);
    } catch {
      return errorResponse(
        {
          code: "FIRESTORE_UNAVAILABLE",
          message: "MFA status could not be verified.",
        },
        requestId,
        503,
      );
    }
    const maxAgeMilliseconds = sessionConfiguration.maxAgeSeconds * 1_000;
    const sessionCookie = crypto.randomUUID();
    const sessionUser = {
      id: decodedToken.uid,
      email: decodedToken.email ?? null,
      displayName:
        typeof decodedToken.name === "string" ? decodedToken.name : null,
      emailVerified: decodedToken.email_verified ?? false,
      mfaEnabled: customMfaEnabled,
    };
    await getAdminFirestore().set(
      keepRedisKey("session", sessionCookie),
      sessionUser,
      { ex: sessionConfiguration.maxAgeSeconds },
    );
    let trustedDeviceId: string | null = null;
    if (shouldRememberDevice && mfaTrustVersion) {
      trustedDeviceId = crypto.randomUUID();
      await getAdminFirestore().set(
        keepRedisKey("mfa-trusted-device", trustedDeviceId),
        {
          userId: decodedToken.uid,
          trustVersion: mfaTrustVersion,
          createdAt: new Date().toISOString(),
        } satisfies TrustedMfaDevice,
        { ex: trustedDeviceMaxAgeSeconds },
      );
    }
    const response = successResponse(
      {
        user: sessionUser,
        expiresAt: new Date(Date.now() + maxAgeMilliseconds).toISOString(),
      },
      requestId,
      201,
    );

    response.headers.append(
      "Set-Cookie",
      `${sessionConfiguration.cookieName}=${sessionCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionConfiguration.maxAgeSeconds}${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
    if (trustedDeviceId) {
      response.headers.append(
        "Set-Cookie",
        `${trustedDeviceCookieName}=${trustedDeviceId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${trustedDeviceMaxAgeSeconds}${
          process.env.NODE_ENV === "production" ? "; Secure" : ""
        }`,
      );
    }
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "REDIS_CONFIGURATION_INCOMPLETE" ||
        error.message.includes("fetch"))
    ) {
      return errorResponse(
        {
          code: "INTERNAL_ERROR",
          message: "Secure session storage is unavailable.",
        },
        requestId,
        503,
      );
    }
    return errorResponse(
      {
        code: "UNAUTHENTICATED",
        message: "The authentication token is invalid.",
      },
      requestId,
      401,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }

  const sessionConfiguration = getSessionConfiguration();
  const sessionId = request.cookies.get(sessionConfiguration.cookieName)?.value;
  if (sessionId)
    await getAdminFirestore().del(keepRedisKey("session", sessionId));
  const response = successResponse({ signedOut: true as const }, requestId);
  response.headers.append(
    "Set-Cookie",
    `${sessionConfiguration.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}
