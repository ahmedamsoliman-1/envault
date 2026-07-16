import { approveDeviceAuthorizationRequestSchema } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ authorizationId: string }> },
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
  const parsed = approveDeviceAuthorizationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { authorizationId } = await context.params;
  const approved = await new DeviceRepository(getAdminFirestore()).approve(
    authorizationId,
    user.id,
    parsed.data.userCode.toUpperCase(),
  );
  if (!approved)
    return errorResponse(
      {
        code: "DEVICE_AUTHORIZATION_EXPIRED",
        message: "The device authorization is invalid or expired.",
      },
      requestId,
      410,
    );
  return successResponse({ approved: true as const }, requestId);
}
