import {
  deleteVersionRequestSchema,
  updatePasswordItemRequestSchema,
} from "@keephq/api-contract";
import { FirestorePasswordRepository } from "@keephq/firebase/repositories/password";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { isPasswordsEnabled } from "@/lib/features";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getWriteAccess } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

function disabledResponse(requestId: string) {
  return errorResponse(
    { code: "PASSWORDS_DISABLED", message: "Keep Passwords is not enabled." },
    requestId,
    404,
  );
}

function versionConflict(
  requestId: string,
  expected: number,
  current: number | undefined,
) {
  return errorResponse(
    {
      code: "PASSWORD_VERSION_CONFLICT",
      message: "The password was changed on another device.",
      details: { expectedVersion: expected, currentVersion: current },
    },
    requestId,
    409,
  );
}

function notFound(requestId: string) {
  return errorResponse(
    { code: "PASSWORD_ITEM_NOT_FOUND", message: "Password not found." },
    requestId,
    404,
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ passwordId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!isPasswordsEnabled()) return disabledResponse(requestId);

  const access = await getWriteAccess(request, "passwords:write");
  if (!access.ok)
    return access.reason === "forbidden"
      ? errorResponse(
          { code: "FORBIDDEN", message: "The request origin is not allowed." },
          requestId,
          403,
        )
      : errorResponse(
          { code: "UNAUTHENTICATED", message: "Authentication is required." },
          requestId,
          401,
        );

  const parsed = updatePasswordItemRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { passwordId } = await context.params;

  try {
    const result = await new FirestorePasswordRepository(
      getAdminFirestore(),
    ).update(access.ownerId, passwordId, parsed.data);
    if (!result) return notFound(requestId);
    if ("conflictVersion" in result)
      return versionConflict(
        requestId,
        parsed.data.expectedVersion,
        result.conflictVersion,
      );
    return successResponse(result, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The password could not be updated.",
      },
      requestId,
      503,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ passwordId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!isPasswordsEnabled()) return disabledResponse(requestId);

  const access = await getWriteAccess(request, "passwords:write");
  if (!access.ok)
    return access.reason === "forbidden"
      ? errorResponse(
          { code: "FORBIDDEN", message: "The request origin is not allowed." },
          requestId,
          403,
        )
      : errorResponse(
          { code: "UNAUTHENTICATED", message: "Authentication is required." },
          requestId,
          401,
        );

  const parsed = deleteVersionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { passwordId } = await context.params;

  try {
    const result = await new FirestorePasswordRepository(
      getAdminFirestore(),
    ).delete(access.ownerId, passwordId, parsed.data.expectedVersion);
    if (!result) return notFound(requestId);
    if ("conflictVersion" in result)
      return versionConflict(
        requestId,
        parsed.data.expectedVersion,
        result.conflictVersion,
      );
    return successResponse(result, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The password could not be deleted.",
      },
      requestId,
      503,
    );
  }
}
