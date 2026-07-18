import { RedisClipboardRepository } from "@keephq/redis/clipboard-repository";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import { emitClipboardEvent, toClipboardItemContentDto } from "@/lib/clipboard";
import {
  getAdminFirestore,
  getClipboardConfiguration,
} from "@/lib/firebase-admin";
import { getRequestPrincipal, getWriteAccess } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

function disabledResponse(requestId: string) {
  return errorResponse(
    { code: "CLIPBOARD_DISABLED", message: "Keep Clipboard is not enabled." },
    requestId,
    404,
  );
}

function notFoundResponse(requestId: string) {
  return errorResponse(
    {
      code: "CLIPBOARD_ITEM_NOT_FOUND",
      message: "The clipboard item was not found.",
    },
    requestId,
    404,
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!getClipboardConfiguration().enabled) return disabledResponse(requestId);

  const principal = await getRequestPrincipal(request, "clipboard:read");
  if (!principal)
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );

  const { itemId } = await context.params;
  try {
    const item = await new RedisClipboardRepository(getAdminFirestore()).get(
      principal.id,
      itemId,
    );
    if (!item) return notFoundResponse(requestId);
    return successResponse(toClipboardItemContentDto(item), requestId);
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Clipboard is unavailable." },
      requestId,
      503,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  if (!getClipboardConfiguration().enabled) return disabledResponse(requestId);

  const access = await getWriteAccess(request, "clipboard:write");
  if (!access.ok)
    return errorResponse(
      access.reason === "forbidden"
        ? { code: "FORBIDDEN", message: "The request origin is not allowed." }
        : { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      access.reason === "forbidden" ? 403 : 401,
    );

  const { itemId } = await context.params;
  try {
    const removed = await new RedisClipboardRepository(
      getAdminFirestore(),
    ).remove(access.ownerId, itemId);
    if (!removed) return notFoundResponse(requestId);
    await emitClipboardEvent(access.ownerId, { type: "deleted", itemId });
    return successResponse({ deleted: true }, requestId);
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Clipboard is unavailable." },
      requestId,
      503,
    );
  }
}
