import { describe, expect, it } from "vitest";

import type { KeepRedis } from "./index";
import {
  RedisClipboardRepository,
  type ClipboardRepositoryConfig,
  type CreateClipboardItemInput,
} from "./clipboard-repository";

class MemoryRedis implements KeepRedis {
  private readonly values = new Map<string, string>();

  public get<T>(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(
      value === undefined ? null : (JSON.parse(value) as T),
    );
  }

  public set(key: string, value: unknown) {
    this.values.set(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    );
    return Promise.resolve("OK");
  }

  public del(key: string) {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }

  // Mirrors the clipboard CAS Lua script: compare-and-set with an ABSENT sentinel.
  public eval(_script: string, keys: string[], args: string[]) {
    const current = this.values.has(keys[0]!)
      ? this.values.get(keys[0]!)!
      : args[2]!;
    if (current !== args[0]) return Promise.resolve(0);
    this.values.set(keys[0]!, args[1]!);
    return Promise.resolve(1);
  }

  // Streams are exercised by clipboard-event-log.test.ts; unused here.
  public xadd() {
    return Promise.resolve("0-0");
  }
  public xrange() {
    return Promise.resolve([]);
  }
  public xrevrange() {
    return Promise.resolve([]);
  }
}

const config: ClipboardRepositoryConfig = {
  defaultTtlSeconds: 604_800,
  oneTimeTtlSeconds: 600,
  sensitiveTtlSeconds: 3_600,
  maxHistoryItems: 3,
  maxPinnedItems: 1,
  dedupeTtlSeconds: 30,
};

const baseInput = (content: string): CreateClipboardItemInput => ({
  content,
  persistenceMode: "temporary",
  originClient: "web",
  language: null,
});

describe("RedisClipboardRepository", () => {
  it("creates, lists and reads back an item", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    const created = await repo.create("user", baseInput("hello world"), config);
    expect(created.kind).toBe("created");

    const list = await repo.list("user");
    expect(list).toHaveLength(1);
    expect(list[0]!.safePreview).toBe("hello world");
    expect(list[0]!.contentType).toBe("text");

    const detail = await repo.get("user", list[0]!.id);
    expect(detail?.content).toBe("hello world");
  });

  it("hides previews and shortens retention for sensitive content", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    const created = await repo.create(
      "user",
      baseInput("PASSWORD=hunter2"),
      config,
    );
    if (created.kind !== "created") throw new Error("expected created");
    expect(created.item.sensitivity).toBe("sensitive");
    expect(created.item.safePreview).toBeNull();
    expect(created.item.expiresAt).not.toBeNull();
  });

  it("suppresses duplicates within the dedupe window", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    const first = await repo.create("user", baseInput("same"), config, 1_000);
    const second = await repo.create("user", baseInput("same"), config, 5_000);
    expect(second.kind).toBe("deduped");
    if (first.kind !== "created" || second.kind !== "deduped")
      throw new Error("unexpected");
    expect(second.item.id).toBe(first.item.id);
    expect(await repo.list("user", 6_000)).toHaveLength(1);
  });

  it("pins (never expires), enforces the pin limit, and unpins", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    const a = await repo.create("user", baseInput("aaa"), config, 1_000);
    const b = await repo.create("user", baseInput("bbb"), config, 2_000);
    if (a.kind !== "created" || b.kind !== "created")
      throw new Error("unexpected");

    const pinned = await repo.pin("user", a.item.id, config, 3_000);
    expect(pinned.kind).toBe("ok");
    if (pinned.kind === "ok") expect(pinned.item.expiresAt).toBeNull();

    expect((await repo.pin("user", b.item.id, config, 3_000)).kind).toBe(
      "pinned_limit",
    );

    const unpinned = await repo.unpin("user", a.item.id, config, 3_000);
    if (unpinned.kind !== "ok") throw new Error("expected ok");
    expect(unpinned.item.expiresAt).not.toBeNull();
  });

  it("removes one-time items on consume and drops expired items from lists", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    const once = await repo.create(
      "user",
      { ...baseInput("secret-token"), persistenceMode: "once" },
      config,
      1_000,
    );
    if (once.kind !== "created") throw new Error("unexpected");

    const consumed = await repo.consume("user", once.item.id, 2_000);
    expect(consumed.kind).toBe("ok");
    expect(await repo.list("user", 3_000)).toHaveLength(0);

    const temp = await repo.create("user", baseInput("temp"), config, 10_000);
    if (temp.kind !== "created") throw new Error("unexpected");
    const afterExpiry = 10_000 + config.oneTimeTtlSeconds * 1000 + 1;
    // a temporary item is still around long after the one-time TTL
    expect(await repo.list("user", afterExpiry)).toHaveLength(1);
  });

  it("trims non-pinned history to the configured maximum", async () => {
    const repo = new RedisClipboardRepository(new MemoryRedis());
    for (let index = 0; index < 5; index += 1)
      await repo.create(
        "user",
        baseInput(`item-${index}`),
        config,
        1_000 + index,
      );
    const list = await repo.list("user", 2_000);
    expect(list).toHaveLength(config.maxHistoryItems);
    // newest survive the trim
    expect(list[0]!.safePreview).toBe("item-4");
  });
});
