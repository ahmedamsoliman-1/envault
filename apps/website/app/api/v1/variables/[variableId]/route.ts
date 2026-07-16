import {
  deleteVersionRequestSchema,
  updateVariableRequestSchema,
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

async function contextFor(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return null;
  return getSessionUser();
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ variableId: string }> },
) {
  const requestId = crypto.randomUUID();
  const user = await contextFor(request);
  if (!user)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Sign in required." },
      requestId,
      401,
    );
  const parsed = updateVariableRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { variableId } = await context.params;
  const result = await new FirestoreEnvironmentRepository(
    getAdminFirestore(),
  ).updateVariable(user.id, variableId, parsed.data);
  if (!result)
    return errorResponse(
      { code: "FORBIDDEN", message: "Variable not found." },
      requestId,
      404,
    );
  if ("conflictVersion" in result)
    return errorResponse(
      {
        code: "ENVIRONMENT_VERSION_CONFLICT",
        message: "The environment changed in another session.",
        details: {
          expectedVersion: parsed.data.expectedVersion,
          currentVersion: result.conflictVersion,
        },
      },
      requestId,
      409,
    );
  if ("duplicate" in result)
    return errorResponse(
      {
        code: "DUPLICATE_VARIABLE",
        message: "A variable with this key already exists.",
      },
      requestId,
      409,
    );
  return successResponse(result, requestId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ variableId: string }> },
) {
  const requestId = crypto.randomUUID();
  const user = await contextFor(request);
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
  const { variableId } = await context.params;
  const result = await new FirestoreEnvironmentRepository(
    getAdminFirestore(),
  ).deleteVariable(user.id, variableId, parsed.data.expectedVersion);
  if (!result)
    return errorResponse(
      { code: "FORBIDDEN", message: "Variable not found." },
      requestId,
      404,
    );
  if ("conflictVersion" in result)
    return errorResponse(
      {
        code: "ENVIRONMENT_VERSION_CONFLICT",
        message: "The environment changed in another session.",
        details: {
          expectedVersion: parsed.data.expectedVersion,
          currentVersion: result.conflictVersion,
        },
      },
      requestId,
      409,
    );
  return successResponse(result, requestId);
}
