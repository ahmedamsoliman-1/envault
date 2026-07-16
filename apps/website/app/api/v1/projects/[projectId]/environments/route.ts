import { createEnvironmentRequestSchema } from "@envault/api-contract";
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
  context: { params: Promise<{ projectId: string }> },
) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request, "environments:read");
  if (!principal)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  const { projectId } = await context.params;
  try {
    const repository = new FirestoreEnvironmentRepository(getAdminFirestore());
    return successResponse(
      { environments: await repository.list(principal.id, projectId) },
      requestId,
    );
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Environments could not be loaded.",
      },
      requestId,
      503,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
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
  const parsed = createEnvironmentRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);
  const { projectId } = await context.params;
  try {
    const repository = new FirestoreEnvironmentRepository(getAdminFirestore());
    const environment = await repository.create(
      user.id,
      projectId,
      parsed.data,
    );
    if (!environment)
      return errorResponse(
        { code: "VAULT_LOCKED", message: "A vault is required." },
        requestId,
        409,
      );
    return successResponse(environment, requestId, 201);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The environment could not be created.",
      },
      requestId,
      503,
    );
  }
}
