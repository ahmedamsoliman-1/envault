import { createVariableRequestSchema } from "@envault/api-contract";
import { FirestoreEnvironmentRepository } from "@envault/firebase/repositories/environment";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getRequestPrincipal } from "@/lib/request-auth";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> },
) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request, "variables:read");
  if (!principal)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  const { environmentId } = await context.params;
  try {
    const result = await new FirestoreEnvironmentRepository(
      getAdminFirestore(),
    ).listVariables(principal.id, environmentId);
    if (!result)
      return errorResponse(
        { code: "FORBIDDEN", message: "The environment is unavailable." },
        requestId,
        404,
      );
    return successResponse(result, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Variables could not be loaded.",
      },
      requestId,
      503,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> },
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
  const parsed = createVariableRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { environmentId } = await context.params;
  try {
    const result = await new FirestoreEnvironmentRepository(
      getAdminFirestore(),
    ).createVariable(user.id, environmentId, parsed.data);
    if (!result)
      return errorResponse(
        { code: "FORBIDDEN", message: "The environment is unavailable." },
        requestId,
        404,
      );
    if ("conflictVersion" in result)
      return errorResponse(
        {
          code: "ENVIRONMENT_VERSION_CONFLICT",
          message: "The environment was changed by another client.",
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
    return successResponse(result, requestId, 201);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The variable could not be created.",
      },
      requestId,
      503,
    );
  }
}
