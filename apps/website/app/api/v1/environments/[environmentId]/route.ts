import {
  deleteVersionRequestSchema,
  updateEnvironmentRequestSchema,
} from "@envault/api-contract";
import { FirestoreEnvironmentRepository } from "@envault/firebase/repositories/environment";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

function conflict(requestId: string, expected: number, current: number) {
  return errorResponse(
    {
      code: "ENVIRONMENT_VERSION_CONFLICT",
      message: "The environment changed in another session.",
      details: { expectedVersion: expected, currentVersion: current },
    },
    requestId,
    409,
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request))
    return errorResponse(
      { code: "FORBIDDEN", message: "Request blocked." },
      requestId,
      403,
    );
  const user = await getSessionUser();
  if (!user)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Sign in required." },
      requestId,
      401,
    );
  const parsed = updateEnvironmentRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { environmentId } = await context.params;
  const result = await new FirestoreEnvironmentRepository(
    getAdminFirestore(),
  ).updateEnvironment(user.id, environmentId, parsed.data);
  if (!result)
    return errorResponse(
      { code: "FORBIDDEN", message: "Environment not found." },
      requestId,
      404,
    );
  if ("conflictVersion" in result && typeof result.conflictVersion === "number")
    return conflict(
      requestId,
      parsed.data.expectedVersion,
      result.conflictVersion,
    );
  return successResponse(result, requestId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request))
    return errorResponse(
      { code: "FORBIDDEN", message: "Request blocked." },
      requestId,
      403,
    );
  const user = await getSessionUser();
  if (!user)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Sign in required." },
      requestId,
      401,
    );
  const parsed = deleteVersionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { environmentId } = await context.params;
  const result = await new FirestoreEnvironmentRepository(
    getAdminFirestore(),
  ).deleteEnvironment(user.id, environmentId, parsed.data.expectedVersion);
  if (!result)
    return errorResponse(
      { code: "FORBIDDEN", message: "Environment not found." },
      requestId,
      404,
    );
  if ("conflictVersion" in result && typeof result.conflictVersion === "number")
    return conflict(
      requestId,
      parsed.data.expectedVersion,
      result.conflictVersion,
    );
  return successResponse(result, requestId);
}
