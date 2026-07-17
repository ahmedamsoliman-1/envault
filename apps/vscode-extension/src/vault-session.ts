import * as vscode from "vscode";

import { autoLockMinutesOverride } from "./config";

/**
 * Holds the unwrapped vault key in memory only. The key never touches
 * SecretStorage, settings, workspace state or disk. It is cleared on manual
 * lock, sign-out, auto-lock expiry and extension deactivation.
 */
export class VaultSession implements vscode.Disposable {
  #key: Uint8Array | null = null;
  #vaultId: string | null = null;
  #autoLockTimer: ReturnType<typeof setTimeout> | null = null;

  readonly #onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this.#onDidChange.event;

  get isUnlocked(): boolean {
    return this.#key !== null;
  }

  get vaultId(): string | null {
    return this.#vaultId;
  }

  /**
   * Returns a defensive copy of the key for the given vault, or `null` if the
   * vault is locked or a different vault is unlocked. Callers must zero the copy
   * (`key.fill(0)`) after use.
   */
  getKey(vaultId: string): Uint8Array | null {
    if (!this.#key || this.#vaultId !== vaultId) return null;
    return this.#key.slice();
  }

  unlock(vaultId: string, key: Uint8Array, autoLockMinutes: number): void {
    this.lock();
    this.#key = key.slice();
    this.#vaultId = vaultId;
    const minutes = autoLockMinutesOverride() ?? autoLockMinutes;
    if (minutes > 0) {
      this.#autoLockTimer = setTimeout(
        () => {
          void vscode.window.showInformationMessage(
            "Envault vault locked automatically.",
          );
          this.lock();
        },
        minutes * 60_000,
      );
    }
    this.#onDidChange.fire();
  }

  lock(): void {
    if (this.#autoLockTimer) {
      clearTimeout(this.#autoLockTimer);
      this.#autoLockTimer = null;
    }
    const wasUnlocked = this.#key !== null;
    this.#key?.fill(0);
    this.#key = null;
    this.#vaultId = null;
    if (wasUnlocked) this.#onDidChange.fire();
  }

  dispose(): void {
    this.lock();
    this.#onDidChange.dispose();
  }
}
