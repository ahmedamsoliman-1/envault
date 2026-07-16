import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { envaultRedisKey } from "@envault/redis";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getPasskeyConfiguration } from "@/lib/passkey-config";
import { PasskeyRepository } from "@/lib/passkey-repository";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }
  const vaultId = new URL(request.url).searchParams.get("vaultId");
  if (!vaultId) return invalidRequestResponse(requestId);
  const credentials = await new PasskeyRepository(getAdminFirestore()).list(
    user.id,
  );
  return successResponse(
    {
      enabled: credentials.some((credential) =>
        Boolean(credential.vaultBindings?.[vaultId]),
      ),
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
  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }
  const body = (await request.json().catch(() => null)) as {
    vaultId?: string;
    mode?: "enroll" | "unlock";
  } | null;
  if (!body?.vaultId || !body.mode) return invalidRequestResponse(requestId);
  const vaultId = body.vaultId;
  const mode = body.mode;

  const redis = getAdminFirestore();
  const credentials = await new PasskeyRepository(redis).list(user.id);
  const eligible = credentials.filter(
    (credential) => mode === "enroll" || credential.vaultBindings?.[vaultId],
  );
  if (!eligible.length) {
    return errorResponse(
      {
        code: "INVALID_REQUEST",
        message:
          mode === "enroll"
            ? "Add a passkey before enabling biometric vault unlock."
            : "Biometric vault unlock is not enabled.",
      },
      requestId,
      400,
    );
  }

  const salts = Object.fromEntries(
    eligible.map((credential) => [
      credential.id,
      mode === "unlock"
        ? credential.vaultBindings![vaultId]!.salt
        : Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
            "base64url",
          ),
    ]),
  );
  const configuration = getPasskeyConfiguration(request);
  const options = await generateAuthenticationOptions({
    rpID: configuration.rpId,
    userVerification: "required",
    allowCredentials: eligible.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    extensions: {
      prf: {
        evalByCredential: Object.fromEntries(
          Object.entries(salts).map(([id, salt]) => [id, { first: salt }]),
        ),
      },
    } as unknown as AuthenticationExtensionsClientInputs,
  });
  const flowId = crypto.randomUUID();
  await redis.set(
    envaultRedisKey("passkey-challenge", "vault", flowId),
    {
      userId: user.id,
      vaultId,
      mode,
      challenge: options.challenge,
      origin: configuration.origin,
      rpId: configuration.rpId,
      salts,
    },
    { ex: 300 },
  );
  return successResponse({ flowId, options }, requestId);
}
