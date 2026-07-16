import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request))
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  const user = await getSessionUser();
  if (!user)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  const { sessionId } = await context.params;
  const revoked = await new DeviceRepository(getAdminFirestore()).revoke(
    user.id,
    sessionId,
  );
  if (!revoked)
    return errorResponse(
      { code: "INVALID_REQUEST", message: "The device session was not found." },
      requestId,
      404,
    );
  return successResponse({ revoked: true as const }, requestId);
}
