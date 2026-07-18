import type { ClipboardItemDto } from "@keephq/api-contract";
import { describe, expect, it } from "vitest";

import { ClipboardEventLog } from "./clipboard-event-log";
import type { KeepRedis, StreamEntry } from "./index";

function compareId(a: string, b: string): number {
  const [am = 0, as = 0] = a.split("-").map(Number);
  const [bm = 0, bs = 0] = b.split("-").map(Number);
  return am !== bm ? am - bm : as - bs;
}

/** Minimal in-memory Redis Stream, sufficient for the event-log contract. */
class MemoryStreamRedis implements KeepRedis {
  private readonly streams = new Map<string, StreamEntry[]>();
  private seq = 0;

  public get<T>(): Promise<T | null> {
    return Promise.resolve(null);
  }
  public set(): Promise<unknown> {
    return Promise.resolve("OK");
  }
  public del(): Promise<number> {
    return Promise.resolve(0);
  }
  public eval(): Promise<unknown> {
    return Promise.resolve(0);
  }

  public xadd(
    key: string,
    fields: Record<string, string>,
    options?: { maxlenApprox?: number },
  ): Promise<string> {
    const id = `${(this.seq += 1)}-0`;
    const entries = this.streams.get(key) ?? [];
    entries.push({ id, fields });
    if (options?.maxlenApprox && entries.length > options.maxlenApprox) {
      entries.splice(0, entries.length - options.maxlenApprox);
    }
    this.streams.set(key, entries);
    return Promise.resolve(id);
  }

  public xrange(
    key: string,
    start: string,
    _end: string,
    count?: number,
  ): Promise<StreamEntry[]> {
    const entries = this.streams.get(key) ?? [];
    const exclusive = start.startsWith("(");
    const from = exclusive ? start.slice(1) : start;
    const matched = entries.filter((entry) => {
      if (start === "-") return true;
      const cmp = compareId(entry.id, from);
      return exclusive ? cmp > 0 : cmp >= 0;
    });
    return Promise.resolve(count ? matched.slice(0, count) : matched);
  }

  public xrevrange(
    key: string,
    _start: string,
    _end: string,
    count?: number,
  ): Promise<StreamEntry[]> {
    const entries = [...(this.streams.get(key) ?? [])].reverse();
    return Promise.resolve(count ? entries.slice(0, count) : entries);
  }
}

const item = (id: string): ClipboardItemDto => ({
  id,
  contentType: "text",
  safePreview: "hello",
  contentHash: "sha256:abc",
  byteLength: 5,
  sensitivity: "normal",
  persistenceMode: "temporary",
  originClient: "web",
  language: null,
  createdAt: "2026-07-18T00:00:00.000Z",
  expiresAt: null,
  pinnedAt: null,
  consumedAt: null,
});

describe("ClipboardEventLog", () => {
  it("appends and reads events in order with parsed payloads", async () => {
    const log = new ClipboardEventLog(new MemoryStreamRedis());
    await log.append("user-1", {
      type: "created",
      itemId: "a",
      item: item("a"),
    });
    await log.append("user-1", { type: "deleted", itemId: "a" });

    const events = await log.readSince("user-1", "0");
    expect(events.map((event) => event.type)).toEqual(["created", "deleted"]);
    expect(events[0]?.item?.id).toBe("a");
    expect(events[1]?.item).toBeUndefined();
    expect(events[0]?.eventId).toBeTruthy();
  });

  it("isolates streams per owner", async () => {
    const log = new ClipboardEventLog(new MemoryStreamRedis());
    await log.append("user-1", {
      type: "created",
      itemId: "a",
      item: item("a"),
    });
    expect(await log.readSince("user-2", "0")).toEqual([]);
  });

  it("resumes from a cursor so a subscriber starting 'now' skips history", async () => {
    const log = new ClipboardEventLog(new MemoryStreamRedis());
    await log.append("user-1", {
      type: "created",
      itemId: "a",
      item: item("a"),
    });

    const cursor = await log.latestCursor("user-1");
    expect(await log.readSince("user-1", cursor)).toEqual([]);

    await log.append("user-1", {
      type: "pinned",
      itemId: "b",
      item: item("b"),
    });
    const fresh = await log.readSince("user-1", cursor);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.itemId).toBe("b");
  });

  it("approx-trims the stream to the configured maximum", async () => {
    const log = new ClipboardEventLog(new MemoryStreamRedis(), 3);
    for (let index = 0; index < 6; index += 1) {
      await log.append("user-1", { type: "deleted", itemId: `i${index}` });
    }
    const events = await log.readSince("user-1", "0");
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.itemId)).toEqual(["i3", "i4", "i5"]);
  });
});
