import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { envaultRedisKey } from "@envault/redis";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { PasskeyRepository } from "@/lib/passkey-repository";
import { hasTrustedOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }
  const body = (await request.json().catch(() => null)) as {
    flowId?: string;
    response?: AuthenticationResponseJSON;
  } | null;
  if (!body?.flowId || !body.response) return invalidRequestResponse(requestId);

  const redis = getAdminFirestore();
  const challengeKey = envaultRedisKey(
    "passkey-challenge",
    "authentication",
    body.flowId,
  );
  const challenge = await redis.get<{
    challenge: string;
    origin: string;
    rpId: string;
  }>(challengeKey);
  await redis.del(challengeKey);
  const repository = new PasskeyRepository(redis);
  const stored = await repository.find(body.response.id);
  if (!challenge || !stored) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "The passkey request is invalid." },
      requestId,
      401,
    );
  }
  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: challenge.origin,
    expectedRPID: challenge.rpId,
    credential: repository.toWebAuthnCredential(stored),
    requireUserVerification: true,
  });
  if (!verification.verified) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Passkey verification failed." },
      requestId,
      401,
    );
  }
  await repository.updateCounter(
    stored.id,
    verification.authenticationInfo.newCounter,
  );
  const passkeyProof = crypto.randomUUID();
  await redis.set(
    envaultRedisKey("passkey-proof", passkeyProof),
    { userId: stored.userId },
    { ex: 120 },
  );
  const customToken = await getAdminAuth().createCustomToken(stored.userId);
  return successResponse({ customToken, passkeyProof }, requestId);
}
