import { importEnvironmentRequestSchema } from "@envault/api-contract";
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ environmentId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!hasTrustedOrigin(request)) {
    return errorResponse(
      { code: "FORBIDDEN", message: "The request origin is not allowed." },
      requestId,
      403,
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  const parsed = importEnvironmentRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  const { environmentId } = await context.params;
  try {
    const result = await new FirestoreEnvironmentRepository(
      getAdminFirestore(),
    ).importVariables(user.id, environmentId, parsed.data);

    if (!result) {
      return errorResponse(
        { code: "FORBIDDEN", message: "The environment is unavailable." },
        requestId,
        404,
      );
    }
    if ("conflictVersion" in result) {
      return errorResponse(
        {
          code: "ENVIRONMENT_VERSION_CONFLICT",
          message: "The environment changed before the import was committed.",
          details: {
            expectedVersion: parsed.data.expectedVersion,
            currentVersion: result.conflictVersion,
          },
        },
        requestId,
        409,
      );
    }
    if ("idempotencyConflict" in result) {
      return errorResponse(
        {
          code: "IDEMPOTENCY_CONFLICT",
          message: "This operation ID was already used for another import.",
        },
        requestId,
        409,
      );
    }
    if ("identityConflict" in result) {
      return errorResponse(
        {
          code: "DUPLICATE_VARIABLE",
          message: "An imported variable no longer matches the current key.",
        },
        requestId,
        409,
      );
    }

    return successResponse(result, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The import could not be committed.",
      },
      requestId,
      503,
    );
  }
}
