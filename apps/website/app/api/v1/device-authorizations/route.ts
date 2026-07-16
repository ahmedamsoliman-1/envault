import { createDeviceAuthorizationRequestSchema } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import { invalidRequestResponse, successResponse } from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import {
  getAdminFirestore,
  getDeviceConfiguration,
} from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const parsed = createDeviceAuthorizationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const configuration = getDeviceConfiguration();
  const authorization = await new DeviceRepository(
    getAdminFirestore(),
  ).createAuthorization({
    ...parsed.data,
    ttlSeconds: configuration.authorizationTtlSeconds,
  });
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;
  return successResponse(
    {
      authorizationId: authorization.id,
      userCode: authorization.userCode,
      verificationUri: `${origin}/device?authorizationId=${authorization.id}&code=${authorization.userCode}`,
      expiresAt: authorization.expiresAt,
      intervalSeconds: 3,
    },
    requestId,
    201,
  );
}
