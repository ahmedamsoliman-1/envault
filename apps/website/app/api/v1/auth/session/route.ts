import { sessionExchangeRequestSchema } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminAuth, getSessionConfiguration } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

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
    const maxAgeMilliseconds = sessionConfiguration.maxAgeSeconds * 1_000;
    const sessionCookie = await firebaseAdminAuth.createSessionCookie(
      result.data.idToken,
      {
        expiresIn: maxAgeMilliseconds,
      },
    );
    const response = successResponse(
      {
        user: {
          id: decodedToken.uid,
          email: decodedToken.email ?? null,
          emailVerified: decodedToken.email_verified ?? false,
          mfaEnabled: Boolean(decodedToken.firebase.sign_in_second_factor),
        },
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
    return response;
  } catch {
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

export function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }

  const sessionConfiguration = getSessionConfiguration();
  const response = successResponse({ signedOut: true as const }, requestId);
  response.headers.append(
    "Set-Cookie",
    `${sessionConfiguration.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );
  return response;
}
