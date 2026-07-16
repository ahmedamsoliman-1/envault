import "server-only";

import type { DeviceScope } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import { DeviceRepository } from "./device-repository";
import { getAdminFirestore } from "./firebase-admin";
import { getSessionUser } from "./session";

export async function getRequestPrincipal(
  request: NextRequest,
  requiredScope?: DeviceScope,
) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const session = await new DeviceRepository(
      getAdminFirestore(),
    ).authenticate(authorization.slice("Bearer ".length));
    if (!session || (requiredScope && !session.scopes.includes(requiredScope)))
      return null;
    return {
      id: session.ownerId,
      kind: "device" as const,
      deviceSessionId: session.id,
      scopes: session.scopes,
    };
  }
  const user = await getSessionUser();
  return user
    ? { id: user.id, kind: "user" as const, user, scopes: null }
    : null;
}
