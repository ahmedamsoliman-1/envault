import { importPasswordsRequestSchema } from "@keephq/api-contract";
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

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!isPasswordsEnabled())
    return errorResponse(
      { code: "PASSWORDS_DISABLED", message: "Keep Passwords is not enabled." },
      requestId,
      404,
    );

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

  const parsed = importPasswordsRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  try {
    const result = await new FirestorePasswordRepository(
      getAdminFirestore(),
    ).importItems(access.ownerId, parsed.data);
    if (!result)
      return errorResponse(
        { code: "FORBIDDEN", message: "A vault is required." },
        requestId,
        404,
      );
    if ("idempotencyConflict" in result)
      return errorResponse(
        {
          code: "IDEMPOTENCY_CONFLICT",
          message: "This import was already submitted with different contents.",
        },
        requestId,
        409,
      );
    return successResponse(result, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The passwords could not be imported.",
      },
      requestId,
      503,
    );
  }
}
