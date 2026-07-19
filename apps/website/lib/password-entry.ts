"use client";

import type { PasswordItemDto } from "@keephq/api-contract";
import { decryptPasswordItem, encryptPasswordItem } from "@keephq/crypto";
import { getBrowserCryptoProvider } from "@keephq/crypto/browser";

/**
 * The decrypted shape of a password entry. The entire object is encrypted
 * client-side into one opaque blob; the server never sees any of these fields.
 */
export interface PasswordEntry {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  folder: string | null;
  tags: string[];
  favorite: boolean;
}

export function emptyPasswordEntry(): PasswordEntry {
  return {
    title: "",
    url: "",
    username: "",
    password: "",
    notes: "",
    folder: null,
    tags: [],
    favorite: false,
  };
}

function normalizeEntry(value: unknown): PasswordEntry {
  const source = (value ?? {}) as Record<string, unknown>;
  const asString = (input: unknown) => (typeof input === "string" ? input : "");
  return {
    title: asString(source.title),
    url: asString(source.url),
    username: asString(source.username),
    password: asString(source.password),
    notes: asString(source.notes),
    folder: typeof source.folder === "string" ? source.folder : null,
    tags: Array.isArray(source.tags)
      ? source.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    favorite: source.favorite === true,
  };
}

export async function encryptPasswordEntry(
  vaultKey: Uint8Array,
  vaultId: string,
  itemId: string,
  entry: PasswordEntry,
): Promise<{ encryptedData: string; encryptionIv: string }> {
  const payload = await encryptPasswordItem(
    getBrowserCryptoProvider(),
    vaultKey,
    JSON.stringify(entry),
    { vaultId, itemId, encryptionVersion: 1 },
  );
  return { encryptedData: payload.ciphertext, encryptionIv: payload.iv };
}

export async function decryptPasswordEntry(
  vaultKey: Uint8Array,
  dto: PasswordItemDto,
): Promise<PasswordEntry> {
  const json = await decryptPasswordItem(
    getBrowserCryptoProvider(),
    vaultKey,
    {
      version: 1,
      algorithm: "AES-GCM",
      ciphertext: dto.encryptedData,
      iv: dto.encryptionIv,
      additionalDataVersion: 1,
    },
    {
      vaultId: dto.vaultId,
      itemId: dto.id,
      encryptionVersion: dto.encryptionVersion,
    },
  );
  return normalizeEntry(JSON.parse(json));
}
