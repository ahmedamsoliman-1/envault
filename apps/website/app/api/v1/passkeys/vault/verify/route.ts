import type { WrappedVaultKeyV1 } from "@envault/crypto";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
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

interface VaultChallenge {
  userId: string;
  vaultId: string;
  mode: "enroll" | "unlock";
  challenge: string;
  origin: string;
  rpId: string;
  salts: Record<string, string>;
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
    response?: AuthenticationResponseJSON;
    wrappedKey?: WrappedVaultKeyV1;
  } | null;
  if (!body?.flowId || !body.response) return invalidRequestResponse(requestId);

  const redis = getAdminFirestore();
  const challengeKey = envaultRedisKey(
    "passkey-challenge",
    "vault",
    body.flowId,
  );
  const challenge = await redis.get<VaultChallenge>(challengeKey);
  await redis.del(challengeKey);
  const repository = new PasskeyRepository(redis);
  const stored = await repository.find(body.response.id);
  if (
    !challenge ||
    challenge.userId !== user.id ||
    stored?.userId !== user.id
  ) {
    return errorResponse(
      { code: "INVALID_REQUEST", message: "The biometric request expired." },
      requestId,
      400,
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
      { code: "UNAUTHENTICATED", message: "Biometric verification failed." },
      requestId,
      401,
    );
  }
  await repository.updateCounter(
    stored.id,
    verification.authenticationInfo.newCounter,
  );

  if (challenge.mode === "enroll") {
    if (!body.wrappedKey) return invalidRequestResponse(requestId);
    await repository.setVaultBinding(stored.id, challenge.vaultId, {
      salt: challenge.salts[stored.id]!,
      wrappedKey: body.wrappedKey,
      createdAt: new Date().toISOString(),
    });
    return successResponse({ enabled: true as const }, requestId);
  }

  const binding = stored.vaultBindings?.[challenge.vaultId];
  if (!binding) {
    return errorResponse(
      {
        code: "INVALID_REQUEST",
        message: "Biometric vault unlock is not enabled for this passkey.",
      },
      requestId,
      400,
    );
  }
  return successResponse({ wrappedKey: binding.wrappedKey }, requestId);
}
