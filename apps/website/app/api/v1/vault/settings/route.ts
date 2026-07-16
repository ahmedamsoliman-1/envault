import { successResponse } from "@/lib/api-response";
import { getSessionConfiguration } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";
import { errorResponse } from "@/lib/api-response";
import { parseServerEnvironment } from "@envault/config/server";

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

  getSessionConfiguration();
  const environment = parseServerEnvironment(process.env);
  return successResponse(
    { pbkdf2Iterations: environment.VAULT_PBKDF2_ITERATIONS },
    requestId,
  );
}
