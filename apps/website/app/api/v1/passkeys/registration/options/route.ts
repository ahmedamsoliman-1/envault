import { generateRegistrationOptions } from "@simplewebauthn/server";
import { envaultRedisKey } from "@envault/redis";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getPasskeyConfiguration } from "@/lib/passkey-config";
import { PasskeyRepository } from "@/lib/passkey-repository";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }
  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  const redis = getAdminFirestore();
  const credentials = await new PasskeyRepository(redis).list(user.id);
  const configuration = getPasskeyConfiguration(request);
  const options = await generateRegistrationOptions({
    rpName: configuration.rpName,
    rpID: configuration.rpId,
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.id,
    userDisplayName: user.displayName ?? user.email ?? "Envault user",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
  });
  const flowId = crypto.randomUUID();
  await redis.set(
    envaultRedisKey("passkey-challenge", "registration", flowId),
    {
      userId: user.id,
      challenge: options.challenge,
      origin: configuration.origin,
      rpId: configuration.rpId,
    },
    { ex: 300 },
  );
  return successResponse({ flowId, options }, requestId);
}
