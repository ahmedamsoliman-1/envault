import type {
  ClipboardItem,
  ClipboardOriginClient,
  ClipboardPersistenceMode,
  ClipboardSensitivity,
} from "@keephq/domain";
import {
  buildSafePreview,
  computeExpiry,
  detectSensitivity,
  inferContentType,
  isClipboardItemExpired,
} from "@keephq/domain";
import { createHash } from "node:crypto";

import { keepRedisKey, type KeepRedis } from "./index";

export interface ClipboardRepositoryConfig {
  defaultTtlSeconds: number;
  oneTimeTtlSeconds: number;
  sensitiveTtlSeconds: number;
  maxHistoryItems: number;
  maxPinnedItems: number;
  dedupeTtlSeconds: number;
}

export interface CreateClipboardItemInput {
  content: string;
  contentType?: ClipboardItem["contentType"];
  persistenceMode: ClipboardPersistenceMode;
  originClient: ClipboardOriginClient;
  language: string | null;
  sensitivity?: ClipboardSensitivity;
}

interface ClipboardStore {
  items: Record<string, ClipboardItem>;
}

const ABSENT = "__keep_clipboard_absent__";
const SENSITIVITY_RANK: Record<ClipboardSensitivity, number> = {
  normal: 0,
  sensitive: 1,
  secret: 2,
};

const storeKey = (ownerId: string) =>
  keepRedisKey("clipboard", "user", ownerId);

const mostSevere = (a: ClipboardSensitivity, b: ClipboardSensitivity) =>
  SENSITIVITY_RANK[a] >= SENSITIVITY_RANK[b] ? a : b;

const contentHash = (content: string) =>
  `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;

const isVisible = (item: ClipboardItem, nowMs: number) =>
  !isClipboardItemExpired(item, nowMs) &&
  !(item.persistenceMode === "once" && item.consumedAt !== null);

/**
 * Removes expired and consumed-one-time items, then trims the non-pinned
 * history to `maxHistoryItems`. Pinned items are never trimmed.
 */
function pruneAndTrim(
  store: ClipboardStore,
  config: ClipboardRepositoryConfig,
  nowMs: number,
) {
  for (const [id, item] of Object.entries(store.items)) {
    if (!isVisible(item, nowMs)) delete store.items[id];
  }
  const nonPinned = Object.values(store.items)
    .filter((item) => item.pinnedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const excess = nonPinned.length - config.maxHistoryItems;
  for (let index = 0; index < excess; index += 1) {
    delete store.items[nonPinned[index]!.id];
  }
}

export class RedisClipboardRepository {
  public constructor(private readonly redis: KeepRedis) {}

  private async mutate<T>(
    ownerId: string,
    change: (store: ClipboardStore) => T,
  ): Promise<T> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const key = storeKey(ownerId);
      const current = await this.redis.get<ClipboardStore>(key);
      const store: ClipboardStore = current ?? { items: {} };
      const before = current === null ? ABSENT : JSON.stringify(current);
      const result = change(store);
      const after = JSON.stringify(store);
      const committed = await this.redis.eval(
        "local cur = redis.call('GET', KEYS[1]); if cur == false then cur = ARGV[3] end; if cur == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end",
        [key],
        [before, after, ABSENT],
      );
      if (committed === 1) return result;
    }
    throw new Error("REDIS_CONCURRENCY_RETRY_EXHAUSTED");
  }

  public async list(
    ownerId: string,
    nowMs = Date.now(),
  ): Promise<ClipboardItem[]> {
    const store = await this.redis.get<ClipboardStore>(storeKey(ownerId));
    if (!store) return [];
    return Object.values(store.items)
      .filter((item) => isVisible(item, nowMs))
      .sort((a, b) => {
        if ((a.pinnedAt === null) !== (b.pinnedAt === null))
          return a.pinnedAt === null ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }

  public async get(
    ownerId: string,
    itemId: string,
    nowMs = Date.now(),
  ): Promise<ClipboardItem | null> {
    const store = await this.redis.get<ClipboardStore>(storeKey(ownerId));
    const item = store?.items[itemId];
    return item && isVisible(item, nowMs) ? item : null;
  }

  public async create(
    ownerId: string,
    input: CreateClipboardItemInput,
    config: ClipboardRepositoryConfig,
    nowMs = Date.now(),
  ): Promise<
    | { kind: "created" | "deduped"; item: ClipboardItem }
    | { kind: "pinned_limit" }
  > {
    const createdAt = new Date(nowMs).toISOString();
    const hash = contentHash(input.content);
    const detected = detectSensitivity(input.content);
    const sensitivity = input.sensitivity
      ? mostSevere(input.sensitivity, detected)
      : detected;
    const item: ClipboardItem = {
      id: crypto.randomUUID(),
      ownerId,
      contentType: input.contentType ?? inferContentType(input.content),
      content: input.content,
      safePreview: buildSafePreview(input.content, sensitivity),
      contentHash: hash,
      byteLength: Buffer.byteLength(input.content, "utf8"),
      sensitivity,
      persistenceMode: input.persistenceMode,
      originClient: input.originClient,
      language: input.language,
      createdAt,
      expiresAt: computeExpiry({
        persistenceMode: input.persistenceMode,
        sensitivity,
        createdAtMs: nowMs,
        config,
      }),
      pinnedAt: input.persistenceMode === "pinned" ? createdAt : null,
      consumedAt: null,
    };

    return this.mutate(ownerId, (store) => {
      pruneAndTrim(store, config, nowMs);
      const duplicate = Object.values(store.items).find(
        (existing) =>
          existing.contentHash === hash &&
          nowMs - Date.parse(existing.createdAt) <=
            config.dedupeTtlSeconds * 1000,
      );
      if (duplicate) return { kind: "deduped" as const, item: duplicate };
      if (
        item.persistenceMode === "pinned" &&
        Object.values(store.items).filter((it) => it.pinnedAt !== null)
          .length >= config.maxPinnedItems
      )
        return { kind: "pinned_limit" as const };
      store.items[item.id] = item;
      pruneAndTrim(store, config, nowMs);
      return { kind: "created" as const, item };
    });
  }

  public async pin(
    ownerId: string,
    itemId: string,
    config: ClipboardRepositoryConfig,
    nowMs = Date.now(),
  ): Promise<
    | { kind: "ok"; item: ClipboardItem }
    | { kind: "not_found" }
    | { kind: "pinned_limit" }
  > {
    return this.mutate(ownerId, (store) => {
      const item = store.items[itemId];
      if (!item || !isVisible(item, nowMs))
        return { kind: "not_found" as const };
      if (item.pinnedAt === null) {
        const pinnedCount = Object.values(store.items).filter(
          (it) => it.pinnedAt !== null,
        ).length;
        if (pinnedCount >= config.maxPinnedItems)
          return { kind: "pinned_limit" as const };
      }
      item.pinnedAt = new Date(nowMs).toISOString();
      item.persistenceMode = "pinned";
      item.expiresAt = null;
      return { kind: "ok" as const, item };
    });
  }

  public async unpin(
    ownerId: string,
    itemId: string,
    config: ClipboardRepositoryConfig,
    nowMs = Date.now(),
  ): Promise<{ kind: "ok"; item: ClipboardItem } | { kind: "not_found" }> {
    return this.mutate(ownerId, (store) => {
      const item = store.items[itemId];
      if (!item || !isVisible(item, nowMs))
        return { kind: "not_found" as const };
      item.pinnedAt = null;
      item.persistenceMode = "temporary";
      item.expiresAt = computeExpiry({
        persistenceMode: "temporary",
        sensitivity: item.sensitivity,
        createdAtMs: nowMs,
        config,
      });
      return { kind: "ok" as const, item };
    });
  }

  public async consume(
    ownerId: string,
    itemId: string,
    nowMs = Date.now(),
  ): Promise<{ kind: "ok"; item: ClipboardItem } | { kind: "not_found" }> {
    return this.mutate(ownerId, (store) => {
      const item = store.items[itemId];
      if (!item || !isVisible(item, nowMs))
        return { kind: "not_found" as const };
      const consumedAt = new Date(nowMs).toISOString();
      const consumed: ClipboardItem = { ...item, consumedAt };
      if (item.persistenceMode === "once") delete store.items[itemId];
      else store.items[itemId] = consumed;
      return { kind: "ok" as const, item: consumed };
    });
  }

  public async remove(
    ownerId: string,
    itemId: string,
    nowMs = Date.now(),
  ): Promise<boolean> {
    return this.mutate(ownerId, (store) => {
      const item = store.items[itemId];
      if (!item || !isVisible(item, nowMs)) return false;
      delete store.items[itemId];
      return true;
    });
  }

  public async clear(ownerId: string): Promise<void> {
    await this.redis.del(storeKey(ownerId));
  }
}
