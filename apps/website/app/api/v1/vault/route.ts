import { createVaultRequestSchema } from "@envault/api-contract";
import { FirestoreVaultRepository } from "@envault/firebase/repositories/vault";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { isEmailVerificationRequired } from "@/lib/features";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  const user = await getSessionUser();
  if (!user) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }
  if (isEmailVerificationRequired() && !user.emailVerified) {
    return errorResponse(
      {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email verification is required.",
      },
      requestId,
      403,
    );
  }

  const repository = new FirestoreVaultRepository(getAdminFirestore());
  const vault = await repository.findByOwnerId(user.id);
  return successResponse({ exists: vault !== null, vault }, requestId);
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
  if (isEmailVerificationRequired() && !user.emailVerified) {
    return errorResponse(
      {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email verification is required.",
      },
      requestId,
      403,
    );
  }

  const parsed = createVaultRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return invalidRequestResponse(requestId);
  }

  try {
    const repository = new FirestoreVaultRepository(getAdminFirestore());
    const vault = await repository.create(user.id, parsed.data);
    return successResponse(vault, requestId, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "VAULT_ALREADY_EXISTS") {
      return errorResponse(
        {
          code: "VAULT_ALREADY_EXISTS",
          message: "A vault already exists for this account.",
        },
        requestId,
        409,
      );
    }
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The vault could not be created.",
      },
      requestId,
      503,
    );
  }
}
