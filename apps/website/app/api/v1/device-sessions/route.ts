import { errorResponse, successResponse } from "@/lib/api-response";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const requestId = crypto.randomUUID();
  const user = await getSessionUser();
  if (!user)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  const sessions = await new DeviceRepository(getAdminFirestore()).listSessions(
    user.id,
  );
  return successResponse(
    sessions.map(
      ({
        id,
        deviceName,
        clientName,
        scopes,
        createdAt,
        expiresAt,
        lastUsedAt,
      }) => ({
        id,
        deviceName,
        clientName,
        scopes,
        createdAt,
        expiresAt,
        lastUsedAt,
      }),
    ),
    requestId,
  );
}
