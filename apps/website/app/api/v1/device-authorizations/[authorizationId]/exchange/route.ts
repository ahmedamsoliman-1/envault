import { exchangeDeviceAuthorizationRequestSchema } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import {
  getAdminFirestore,
  getDeviceConfiguration,
} from "@/lib/firebase-admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ authorizationId: string }> },
) {
  const requestId = crypto.randomUUID();
  const parsed = exchangeDeviceAuthorizationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { authorizationId } = await context.params;
  const result = await new DeviceRepository(getAdminFirestore()).exchange(
    authorizationId,
    parsed.data.codeVerifier,
    getDeviceConfiguration().sessionMaxAgeSeconds,
  );
  if ("expired" in result)
    return errorResponse(
      {
        code: "DEVICE_AUTHORIZATION_EXPIRED",
        message: "The device authorization expired.",
      },
      requestId,
      410,
    );
  if ("used" in result)
    return errorResponse(
      {
        code: "DEVICE_AUTHORIZATION_ALREADY_USED",
        message: "The device authorization was already exchanged.",
      },
      requestId,
      409,
    );
  if ("pending" in result)
    return successResponse({ status: "pending" as const }, requestId, 202);
  if ("invalidVerifier" in result)
    return errorResponse(
      { code: "FORBIDDEN", message: "The device verifier is invalid." },
      requestId,
      403,
    );
  return successResponse(
    {
      status: "authorized" as const,
      accessToken: result.token,
      session: result.session,
    },
    requestId,
    201,
  );
}
