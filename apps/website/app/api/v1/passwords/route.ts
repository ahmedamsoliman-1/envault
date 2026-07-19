import { createPasswordItemRequestSchema } from "@keephq/api-contract";
import { FirestorePasswordRepository } from "@keephq/firebase/repositories/password";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { isPasswordsEnabled } from "@/lib/features";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getRequestPrincipal, getWriteAccess } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

function disabledResponse(requestId: string) {
  return errorResponse(
    { code: "PASSWORDS_DISABLED", message: "Keep Passwords is not enabled." },
    requestId,
    404,
  );
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!isPasswordsEnabled()) return disabledResponse(requestId);

  const principal = await getRequestPrincipal(request, "passwords:read");
  if (!principal)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );

  try {
    const items = await new FirestorePasswordRepository(
      getAdminFirestore(),
    ).list(principal.id);
    return successResponse({ items }, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Passwords could not be loaded.",
      },
      requestId,
      503,
    );
  }
}

export async function POST(request: NextRequest) {
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

  const parsed = createPasswordItemRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  try {
    const result = await new FirestorePasswordRepository(
      getAdminFirestore(),
    ).create(access.ownerId, parsed.data);
    if (!result)
      return errorResponse(
        { code: "FORBIDDEN", message: "A vault is required." },
        requestId,
        404,
      );
    if ("duplicate" in result)
      return errorResponse(
        {
          code: "DUPLICATE_PASSWORD",
          message: "A password with this id already exists.",
        },
        requestId,
        409,
      );
    return successResponse(result, requestId, 201);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The password could not be saved.",
      },
      requestId,
      503,
    );
  }
}
