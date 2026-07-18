import "server-only";

import type {
  ClipboardItemContentDto,
  ClipboardItemDto,
} from "@keephq/api-contract";
import type { ClipboardItem } from "@keephq/domain";
import {
  ClipboardEventLog,
  type ClipboardEventInput,
} from "@keephq/redis/clipboard-event-log";
import type { ClipboardRepositoryConfig } from "@keephq/redis/clipboard-repository";

import { getAdminFirestore, getClipboardConfiguration } from "./firebase-admin";

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

export function getClipboardEventLog(
  configuration = getClipboardConfiguration(),
) {
  return new ClipboardEventLog(getAdminFirestore(), configuration.streamMaxLen);
}

/**
 * Best-effort real-time fan-out. Appending to the durable event stream must
 * never fail the mutation that produced it — a dropped event only means a
 * momentary loss of liveness, and connected clients still reconcile on their
 * next reconnect/snapshot.
 */
export async function emitClipboardEvent(
  ownerId: string,
  input: ClipboardEventInput,
): Promise<void> {
  try {
    await getClipboardEventLog().append(ownerId, input);
  } catch (error) {
    console.warn("clipboard event emit failed", error);
  }
}
