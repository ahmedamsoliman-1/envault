import { RedisClipboardRepository } from "@keephq/redis/clipboard-repository";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  clipboardRepositoryConfig,
  emitClipboardEvent,
  toClipboardItemDto,
} from "@/lib/clipboard";
import {
  getAdminFirestore,
  getClipboardConfiguration,
} from "@/lib/firebase-admin";
import { getWriteAccess } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> },
) {
  const requestId = crypto.randomUUID();
  const configuration = getClipboardConfiguration();
  if (!configuration.enabled)
    return errorResponse(
      { code: "CLIPBOARD_DISABLED", message: "Keep Clipboard is not enabled." },
      requestId,
      404,
    );

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
    const result = await new RedisClipboardRepository(getAdminFirestore()).pin(
      access.ownerId,
      itemId,
      clipboardRepositoryConfig(configuration),
    );
    if (result.kind === "not_found")
      return errorResponse(
        {
          code: "CLIPBOARD_ITEM_NOT_FOUND",
          message: "The clipboard item was not found.",
        },
        requestId,
        404,
      );
    if (result.kind === "pinned_limit")
      return errorResponse(
        {
          code: "CLIPBOARD_PINNED_LIMIT",
          message: "The maximum number of pinned items has been reached.",
        },
        requestId,
        409,
      );
    const dto = toClipboardItemDto(result.item);
    await emitClipboardEvent(access.ownerId, {
      type: "pinned",
      itemId: dto.id,
      item: dto,
    });
    return successResponse(dto, requestId);
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Clipboard is unavailable." },
      requestId,
      503,
    );
  }
}
