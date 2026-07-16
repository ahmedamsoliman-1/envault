import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ authorizationId: string }> },
) {
  const requestId = crypto.randomUUID();
  const { authorizationId } = await context.params;
  const authorization = await new DeviceRepository(
    getAdminFirestore(),
  ).findAuthorization(authorizationId);
  if (!authorization)
    return errorResponse(
      {
        code: "DEVICE_AUTHORIZATION_EXPIRED",
        message: "The device authorization expired.",
      },
      requestId,
      410,
    );
  return successResponse(
    {
      status: authorization.usedAt
        ? ("used" as const)
        : authorization.approvedAt
          ? ("approved" as const)
          : ("pending" as const),
      expiresAt: authorization.expiresAt,
      deviceName: authorization.deviceName,
      clientName: authorization.clientName,
      scopes: authorization.scopes,
    },
    requestId,
  );
}
