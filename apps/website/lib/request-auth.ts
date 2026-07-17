import "server-only";

import type { DeviceScope } from "@envault/api-contract";
import type { NextRequest } from "next/server";

import { DeviceRepository } from "./device-repository";
import { getAdminFirestore } from "./firebase-admin";
import { hasTrustedOrigin } from "./request-security";
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

export type WriteAccess =
  | { ok: true; ownerId: string }
  | { ok: false; reason: "forbidden" | "unauthenticated" };

/**
 * Authorizes a state-changing request from either a browser session or an
 * external device.
 *
 * Browser (cookie) requests are protected against CSRF by a trusted-origin
 * check. Device (Bearer token) requests carry no ambient authority, so origin
 * is irrelevant; they are authorized by the token and the required scope. This
 * lets clients such as the VS Code extension push encrypted changes through the
 * same route the website uses.
 */
export async function getWriteAccess(
  request: NextRequest,
  requiredScope: DeviceScope,
): Promise<WriteAccess> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const principal = await getRequestPrincipal(request, requiredScope);
    return principal
      ? { ok: true, ownerId: principal.id }
      : { ok: false, reason: "unauthenticated" };
  }
  if (!hasTrustedOrigin(request)) return { ok: false, reason: "forbidden" };
  const user = await getSessionUser();
  return user
    ? { ok: true, ownerId: user.id }
    : { ok: false, reason: "unauthenticated" };
}
