import { deviceWrappedVaultKeySchema } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getRequestPrincipal } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

function unauthenticated(requestId: string) {
  return errorResponse(
    {
      code: "UNAUTHENTICATED",
      message: "A device session is required.",
    },
    requestId,
    401,
  );
}

/**
 * Returns the device-wrapped vault key stored for the current device session,
 * enabling silent unlock. Revoking the session removes the record, so a revoked
 * device can no longer unlock without the passphrase.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request);
  if (!principal || principal.kind !== "device") {
    return unauthenticated(requestId);
  }
  const wrapped = await new DeviceRepository(getAdminFirestore()).getVaultKey(
    principal.deviceSessionId,
    principal.id,
  );
  return successResponse({ wrapped }, requestId);
}

export async function PUT(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request);
  if (!principal || principal.kind !== "device") {
    return unauthenticated(requestId);
  }
  const parsed = deviceWrappedVaultKeySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  const stored = await new DeviceRepository(getAdminFirestore()).storeVaultKey(
    principal.deviceSessionId,
    principal.id,
    parsed.data,
  );
  if (!stored) {
    return errorResponse(
      {
        code: "DEVICE_SESSION_REVOKED",
        message: "The device session is no longer valid.",
      },
      requestId,
      404,
    );
  }
  return successResponse(parsed.data, requestId);
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request);
  if (!principal || principal.kind !== "device") {
    return unauthenticated(requestId);
  }
  await new DeviceRepository(getAdminFirestore()).deleteVaultKey(
    principal.deviceSessionId,
    principal.id,
  );
  return successResponse({ deleted: true as const }, requestId);
}
