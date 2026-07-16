import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { envaultRedisKey } from "@envault/redis";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { PasskeyRepository } from "@/lib/passkey-repository";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

interface RegistrationChallenge {
  userId: string;
  challenge: string;
  origin: string;
  rpId: string;
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
  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }
  const body = (await request.json().catch(() => null)) as {
    flowId?: string;
    name?: string;
    response?: RegistrationResponseJSON;
  } | null;
  if (!body?.flowId || !body.response) return invalidRequestResponse(requestId);

  const redis = getAdminFirestore();
  const challengeKey = envaultRedisKey(
    "passkey-challenge",
    "registration",
    body.flowId,
  );
  const challenge = await redis.get<RegistrationChallenge>(challengeKey);
  await redis.del(challengeKey);
  if (!challenge || challenge.userId !== user.id) {
    return errorResponse(
      { code: "INVALID_REQUEST", message: "The passkey request expired." },
      requestId,
      400,
    );
  }

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpId,
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    return errorResponse(
      { code: "INVALID_REQUEST", message: "Passkey verification failed." },
      requestId,
      400,
    );
  }
  const stored = await new PasskeyRepository(redis).create(
    user.id,
    body.name?.trim().slice(0, 80) || "Passkey",
    verification.registrationInfo.credential,
    verification.registrationInfo.credentialDeviceType,
    verification.registrationInfo.credentialBackedUp,
  );
  return successResponse(
    { id: stored.id, name: stored.name, createdAt: stored.createdAt },
    requestId,
    201,
  );
}
