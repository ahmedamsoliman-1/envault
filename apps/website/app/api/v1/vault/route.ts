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
import { getRequestPrincipal } from "@/lib/request-auth";
import { hasTrustedOrigin } from "@/lib/request-security";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  // Device clients (e.g. the VS Code extension) authenticate with a scoped
  // Bearer token and need the wrapped key material to unlock locally. The
  // wrapped key is encrypted and useless without the passphrase or recovery
  // key, so exposing it to an owner-scoped device session is safe.
  const principal = await getRequestPrincipal(request, "environments:read");
  if (!principal) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }
  if (
    principal.kind === "user" &&
    isEmailVerificationRequired() &&
    !principal.user.emailVerified
  ) {
    return errorResponse(
      {
        code: "EMAIL_NOT_VERIFIED",
        message: "Email verification is required.",
      },
      requestId,
      403,
    );
  }

  try {
    const repository = new FirestoreVaultRepository(getAdminFirestore());
    const vault = await repository.findByOwnerId(principal.id);
    return successResponse({ exists: vault !== null, vault }, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Vault status could not be loaded.",
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
