import "server-only";

import type {
  ClipboardItemContentDto,
  ClipboardItemDto,
} from "@keephq/api-contract";
import type { ClipboardItem } from "@keephq/domain";
import type { ClipboardRepositoryConfig } from "@keephq/redis/clipboard-repository";

import { getClipboardConfiguration } from "./firebase-admin";

export function clipboardRepositoryConfig(
  configuration = getClipboardConfiguration(),
): ClipboardRepositoryConfig {
  return {
    defaultTtlSeconds: configuration.defaultTtlSeconds,
    oneTimeTtlSeconds: configuration.oneTimeTtlSeconds,
    sensitiveTtlSeconds: configuration.sensitiveTtlSeconds,
    maxHistoryItems: configuration.maxHistoryItems,
    maxPinnedItems: configuration.maxPinnedItems,
    dedupeTtlSeconds: configuration.dedupeTtlSeconds,
  };
}

/** Metadata-only projection — never leaks the stored content or the ownerId. */
export function toClipboardItemDto(item: ClipboardItem): ClipboardItemDto {
  return {
    id: item.id,
    contentType: item.contentType,
    safePreview: item.safePreview,
    contentHash: item.contentHash,
    byteLength: item.byteLength,
    sensitivity: item.sensitivity,
    persistenceMode: item.persistenceMode,
    originClient: item.originClient,
    language: item.language,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    pinnedAt: item.pinnedAt,
    consumedAt: item.consumedAt,
  };
}

export function toClipboardItemContentDto(
  item: ClipboardItem,
): ClipboardItemContentDto {
  return { ...toClipboardItemDto(item), content: item.content };
}
