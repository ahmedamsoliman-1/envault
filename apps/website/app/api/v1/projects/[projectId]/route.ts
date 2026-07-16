import { updateProjectRequestSchema } from "@envault/api-contract";
import { FirestoreProjectRepository } from "@envault/firebase/repositories/project";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
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
  const parsed = updateProjectRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { projectId } = await context.params;
  try {
    const project = await new FirestoreProjectRepository(
      getAdminFirestore(),
    ).update(user.id, projectId, parsed.data);
    return project
      ? successResponse(project, requestId)
      : errorResponse(
          { code: "FORBIDDEN", message: "Project not found." },
          requestId,
          404,
        );
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Project update failed." },
      requestId,
      503,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
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
  const { projectId } = await context.params;
  try {
    const deleted = await new FirestoreProjectRepository(
      getAdminFirestore(),
    ).delete(user.id, projectId);
    return deleted
      ? successResponse({ deleted: true as const }, requestId)
      : errorResponse(
          { code: "FORBIDDEN", message: "Project not found." },
          requestId,
          404,
        );
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Project deletion failed." },
      requestId,
      503,
    );
  }
}
