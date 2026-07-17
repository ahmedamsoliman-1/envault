import { createClipboardItemRequestSchema } from "@keephq/api-contract";
import { RedisClipboardRepository } from "@keephq/redis/clipboard-repository";
import type { NextRequest } from "next/server";

import {
  errorResponse,
  invalidRequestResponse,
  successResponse,
} from "@/lib/api-response";
import { clipboardRepositoryConfig, toClipboardItemDto } from "@/lib/clipboard";
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

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const configuration = getClipboardConfiguration();
  if (!configuration.enabled) return disabledResponse(requestId);

  const principal = await getRequestPrincipal(request, "clipboard:read");
  if (!principal) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  try {
    const repository = new RedisClipboardRepository(getAdminFirestore());
    const items = await repository.list(principal.id);
    return successResponse({ items: items.map(toClipboardItemDto) }, requestId);
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "Clipboard history could not be loaded.",
      },
      requestId,
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const configuration = getClipboardConfiguration();
  if (!configuration.enabled) return disabledResponse(requestId);

  const access = await getWriteAccess(request, "clipboard:write");
  if (!access.ok) {
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
  }

  const parsed = createClipboardItemRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidRequestResponse(requestId);

  if (
    Buffer.byteLength(parsed.data.content, "utf8") > configuration.maxTextBytes
  ) {
    return errorResponse(
      {
        code: "CLIPBOARD_PAYLOAD_TOO_LARGE",
        message: "The clipboard item exceeds the maximum allowed size.",
      },
      requestId,
      413,
    );
  }

  try {
    const repository = new RedisClipboardRepository(getAdminFirestore());
    const result = await repository.create(
      access.ownerId,
      parsed.data,
      clipboardRepositoryConfig(configuration),
    );
    if (result.kind === "pinned_limit") {
      return errorResponse(
        {
          code: "CLIPBOARD_PINNED_LIMIT",
          message: "The maximum number of pinned items has been reached.",
        },
        requestId,
        409,
      );
    }
    return successResponse(
      toClipboardItemDto(result.item),
      requestId,
      result.kind === "created" ? 201 : 200,
    );
  } catch {
    return errorResponse(
      {
        code: "FIRESTORE_UNAVAILABLE",
        message: "The clipboard item could not be saved.",
      },
      requestId,
      503,
    );
  }
}
