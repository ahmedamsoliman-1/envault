import { createProjectRequestSchema } from "@envault/api-contract";
import { FirestoreProjectRepository } from "@envault/firebase/repositories/project";
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

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const principal = await getRequestPrincipal(request, "projects:read");
  if (!principal) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  try {
    const repository = new FirestoreProjectRepository(getAdminFirestore());
    return successResponse(
      { projects: await repository.list(principal.id) },
      requestId,
    );
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Projects could not be loaded.",
      },
      requestId,
      503,
    );
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = createProjectRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  try {
    const repository = new FirestoreProjectRepository(getAdminFirestore());
    const project = await repository.create(user.id, parsed.data);
    if (!project) {
      return errorResponse(
        {
          code: "VAULT_LOCKED",
          message: "Create a vault before adding projects.",
        },
        requestId,
        409,
      );
    }
    return successResponse(project, requestId, 201);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The project could not be created.",
      },
      requestId,
      503,
    );
  }
}
