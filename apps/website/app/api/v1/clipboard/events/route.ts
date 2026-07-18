import type { NextRequest } from "next/server";

import { errorResponse } from "@/lib/api-response";
import { getClipboardEventLog } from "@/lib/clipboard";
import { getClipboardConfiguration } from "@/lib/firebase-admin";
import { getRequestPrincipal } from "@/lib/request-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Kept under Vercel's function ceiling; the browser's EventSource reconnects
// and resumes from Last-Event-ID, so a short-lived connection loses nothing.
export const maxDuration = 30;

const CONNECTION_TTL_MS = 25_000;
const POLL_INTERVAL_MS = 1_000;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Server-Sent Events tail of the caller's clipboard event stream. Streams
 * deltas so connected clients (other tabs, other devices) stay live without
 * polling the full history. Bounded to `CONNECTION_TTL_MS`; the client resumes
 * from its last cursor on reconnect via the `Last-Event-ID` header.
 */
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!getClipboardConfiguration().enabled) {
    return errorResponse(
      { code: "CLIPBOARD_DISABLED", message: "Keep Clipboard is not enabled." },
      requestId,
      404,
    );
  }

  const principal = await getRequestPrincipal(request, "clipboard:read");
  if (!principal) {
    return errorResponse(
      { code: "UNAUTHENTICATED", message: "Authentication is required." },
      requestId,
      401,
    );
  }

  const ownerId = principal.id;
  const log = getClipboardEventLog();
  const requestedCursor =
    request.headers.get("last-event-id") ??
    new URL(request.url).searchParams.get("cursor");

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client gone); the loop guard stops us.
        }
      };

      // Fresh connections start at "now" so we don't replay retained history
      // the client already has from its snapshot load.
      let cursor = requestedCursor ?? (await log.latestCursor(ownerId));

      send("retry: 3000\n\n");
      send(": connected\n\n");

      const deadline = Date.now() + CONNECTION_TTL_MS;
      try {
        while (!signal.aborted && Date.now() < deadline) {
          const events = await log.readSince(ownerId, cursor, 100);
          if (events.length > 0) {
            for (const event of events) {
              send(
                `id: ${event.eventId}\ndata: ${JSON.stringify({
                  eventId: event.eventId,
                  type: event.type,
                  itemId: event.itemId,
                  item: event.item ?? null,
                  createdAt: event.createdAt,
                })}\n\n`,
              );
              cursor = event.eventId;
            }
          } else {
            send(": keep-alive\n\n");
          }
          await delay(POLL_INTERVAL_MS, signal);
        }
      } catch (error) {
        console.warn("clipboard SSE stream error", error);
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering so events flush immediately.
      "x-accel-buffering": "no",
    },
  });
}
