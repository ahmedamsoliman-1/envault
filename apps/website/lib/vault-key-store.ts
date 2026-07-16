"use client";

let activeVaultKey: Uint8Array | null = null;

export function setActiveVaultKey(key: Uint8Array) {
  clearActiveVaultKey();
  activeVaultKey = key.slice();
}

export function getActiveVaultKey() {
  return activeVaultKey?.slice() ?? null;
}

export function clearActiveVaultKey() {
  activeVaultKey?.fill(0);
  activeVaultKey = null;
}
