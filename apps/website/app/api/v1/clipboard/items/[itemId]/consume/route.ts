import { RedisClipboardRepository } from "@keephq/redis/clipboard-repository";
import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  emitClipboardEvent,
  toClipboardItemContentDto,
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
  if (!getClipboardConfiguration().enabled)
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
    const result = await new RedisClipboardRepository(
      getAdminFirestore(),
    ).consume(access.ownerId, itemId);
    if (result.kind === "not_found")
      return errorResponse(
        {
          code: "CLIPBOARD_ITEM_NOT_FOUND",
          message: "The clipboard item was not found.",
        },
        requestId,
        404,
      );
    await emitClipboardEvent(access.ownerId, {
      type: "consumed",
      itemId: result.item.id,
      item: toClipboardItemDto(result.item),
    });
    // Returns content so a one-time item can be copied as it is consumed.
    return successResponse(toClipboardItemContentDto(result.item), requestId);
  } catch {
    return errorResponse(
      { code: "FIRESTORE_UNAVAILABLE", message: "Clipboard is unavailable." },
      requestId,
      503,
    );
  }
}
