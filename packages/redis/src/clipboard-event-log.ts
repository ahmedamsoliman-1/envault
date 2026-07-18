import type { ClipboardItemDto } from "@keephq/api-contract";

import { keepRedisKey, type KeepRedis } from "./index";

/**
 * Synchronization event types. Mirrors the web/device mutations; `device.*`
 * events arrive with Phase 14b (device management) and are intentionally
 * absent here.
 */
export type ClipboardEventType =
  "created" | "updated" | "deleted" | "consumed" | "pinned" | "unpinned";

export interface ClipboardEventInput {
  type: ClipboardEventType;
  itemId: string;
  /**
   * Sanitized metadata projection (never the raw content). Present for upsert
   * events so subscribers can apply a delta without re-fetching; omitted for
   * `deleted`.
   */
  item?: ClipboardItemDto;
}

export interface ClipboardStreamEvent extends ClipboardEventInput {
  /** The Redis Stream entry ID — also the resume cursor. */
  eventId: string;
  createdAt: string;
}

const DEFAULT_STREAM_MAXLEN = 1000;

const streamKey = (ownerId: string) =>
  keepRedisKey("clipboard", "user", ownerId, "stream");

/** A Redis Stream ID is `<ms>-<seq>`; the millisecond prefix is the timestamp. */
function eventCreatedAt(eventId: string): string {
  const milliseconds = Number.parseInt(eventId.split("-")[0] ?? "", 10);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
}

/**
 * Durable, per-user log of clipboard mutations backed by a Redis Stream. It is
 * the source of truth for real-time delivery: transports (SSE today) tail it
 * and reconnecting clients resume from their last cursor, so a brief
 * disconnection never loses an event.
 */
export class ClipboardEventLog {
  public constructor(
    private readonly redis: KeepRedis,
    private readonly maxlenApprox: number = DEFAULT_STREAM_MAXLEN,
  ) {}

  public append(ownerId: string, input: ClipboardEventInput): Promise<string> {
    return this.redis.xadd(
      streamKey(ownerId),
      { data: JSON.stringify(input) },
      { maxlenApprox: this.maxlenApprox },
    );
  }

  /**
   * The current tail cursor, used to start a fresh subscription from "now" so a
   * newly connected client is not replayed the entire retained history (it
   * already loaded a snapshot over the list API). Returns `"0"` when empty.
   */
  public async latestCursor(ownerId: string): Promise<string> {
    const [last] = await this.redis.xrevrange(streamKey(ownerId), "+", "-", 1);
    return last?.id ?? "0";
  }

  /** Events strictly after `cursor` (exclusive), oldest first. */
  public async readSince(
    ownerId: string,
    cursor: string,
    count = 100,
  ): Promise<ClipboardStreamEvent[]> {
    const entries = await this.redis.xrange(
      streamKey(ownerId),
      `(${cursor}`,
      "+",
      count,
    );
    return entries.map((entry) => {
      const input = JSON.parse(
        entry.fields.data ?? "{}",
      ) as ClipboardEventInput;
      return {
        ...input,
        eventId: entry.id,
        createdAt: eventCreatedAt(entry.id),
      };
    });
  }
}
