import type { EnvaultClient } from "@envault/api-client";
import type { VaultDto } from "@envault/api-contract";
import {
  unlockVaultWithDeviceSecret,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
  wrapVaultKeyWithDeviceSecret,
  type VaultKeyMaterialV1,
} from "@envault/crypto";
import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

import { requireClient } from "./client";
import { DEVICE_SECRET_KEY } from "./config";
import { cryptoProvider } from "./crypto";
import type { VaultSession } from "./vault-session";

const DEVICE_SECRET_BYTES = 32;

function materialFromVault(vault: VaultDto): VaultKeyMaterialV1 {
  return {
    protocolVersion: vault.protocolVersion,
    passphraseDerivation: vault.passphraseDerivation,
    passphraseWrappedKey: vault.passphraseWrappedKey,
    recoveryDerivation: vault.recoveryDerivation,
    recoveryWrappedKey: vault.recoveryWrappedKey,
  };
}

async function readDeviceSecret(
  context: vscode.ExtensionContext,
): Promise<Uint8Array | null> {
  const stored = await context.secrets.get(DEVICE_SECRET_KEY);
  if (!stored) return null;
  try {
    return new Uint8Array(Buffer.from(stored, "base64"));
  } catch {
    return null;
  }
}

/**
 * Establishes a device-wrapped copy of the vault key so future sessions unlock
 * without the passphrase. The random device secret stays in SecretStorage; only
 * the wrapped material is persisted server-side, bound to this revocable device
 * session.
 */
async function establishDeviceKey(
  context: vscode.ExtensionContext,
  client: EnvaultClient,
  vaultId: string,
  key: Uint8Array,
): Promise<void> {
  const deviceSecret = new Uint8Array(randomBytes(DEVICE_SECRET_BYTES));
  try {
    const wrappedKey = await wrapVaultKeyWithDeviceSecret(
      cryptoProvider,
      vaultId,
      key,
      deviceSecret,
    );
    await client.devices.putVaultKey({ vaultId, wrappedKey });
    await context.secrets.store(
      DEVICE_SECRET_KEY,
      Buffer.from(deviceSecret).toString("base64"),
    );
  } catch {
    // Silent unlock is a convenience; failing to set it up must not block the
    // current unlock. The next unlock simply prompts for the passphrase again.
    await context.secrets.delete(DEVICE_SECRET_KEY);
  } finally {
    deviceSecret.fill(0);
  }
}

/** Removes device-wrapped unlock material both locally and server-side. */
export async function forgetDeviceKey(
  context: vscode.ExtensionContext,
  client: EnvaultClient | null,
): Promise<void> {
  await context.secrets.delete(DEVICE_SECRET_KEY);
  try {
    await client?.devices.deleteVaultKey();
  } catch {
    // Best effort — the record also disappears when the session is revoked.
  }
}

async function trySilentUnlock(
  context: vscode.ExtensionContext,
  client: EnvaultClient,
  session: VaultSession,
  vault: VaultDto,
): Promise<Uint8Array | null> {
  const deviceSecret = await readDeviceSecret(context);
  if (!deviceSecret) return null;
  try {
    const { wrapped } = await client.devices.getVaultKey();
    if (!wrapped || wrapped.vaultId !== vault.vaultId) {
      // Revoked or replaced server-side: drop the now-useless local secret.
      await context.secrets.delete(DEVICE_SECRET_KEY);
      return null;
    }
    const key = await unlockVaultWithDeviceSecret(
      cryptoProvider,
      vault.vaultId,
      wrapped.wrappedKey,
      deviceSecret,
    );
    session.unlock(vault.vaultId, key, vault.autoLockMinutes);
    const copy = session.getKey(vault.vaultId);
    key.fill(0);
    return copy;
  } catch {
    return null;
  } finally {
    deviceSecret.fill(0);
  }
}

async function promptUnlock(
  context: vscode.ExtensionContext,
  client: EnvaultClient,
  session: VaultSession,
  vault: VaultDto,
): Promise<Uint8Array | null> {
  const method = await vscode.window.showQuickPick(
    [
      { label: "Passphrase", value: "passphrase" as const },
      { label: "Recovery key", value: "recovery" as const },
    ],
    { placeHolder: "Unlock the Envault vault" },
  );
  if (!method) return null;

  const secret = await vscode.window.showInputBox({
    prompt:
      method.value === "passphrase"
        ? "Enter your vault passphrase"
        : "Enter your recovery key",
    password: true,
    ignoreFocusOut: true,
  });
  if (!secret) return null;

  const material = materialFromVault(vault);
  let key: Uint8Array;
  try {
    key =
      method.value === "passphrase"
        ? await unlockVaultWithPassphrase(
            cryptoProvider,
            vault.vaultId,
            secret,
            material,
          )
        : await unlockVaultWithRecoveryKey(
            cryptoProvider,
            vault.vaultId,
            secret,
            material,
          );
  } catch {
    void vscode.window.showErrorMessage(
      method.value === "passphrase"
        ? "The vault passphrase is incorrect."
        : "The recovery key is invalid.",
    );
    return null;
  }

  session.unlock(vault.vaultId, key, vault.autoLockMinutes);
  await establishDeviceKey(context, client, vault.vaultId, key);
  const copy = session.getKey(vault.vaultId);
  key.fill(0);
  return copy;
}

/**
 * Ensures the vault is unlocked and returns a defensive copy of the vault key
 * (which the caller must zero after use), or `null` if unlocking did not
 * complete. Tries, in order: an already-unlocked in-memory key, a silent
 * device-wrapped unlock, then an interactive passphrase/recovery prompt.
 */
export async function ensureUnlocked(
  context: vscode.ExtensionContext,
  session: VaultSession,
): Promise<{ key: Uint8Array; vault: VaultDto } | null> {
  const client = await requireClient(context);
  if (!client) return null;

  let vault: VaultDto | null;
  try {
    const status = await client.vault.get();
    vault = status.vault;
  } catch (error) {
    void vscode.window.showErrorMessage(
      error instanceof Error
        ? error.message
        : "The Envault vault could not be loaded.",
    );
    return null;
  }
  if (!vault) {
    void vscode.window.showWarningMessage(
      "No Envault vault exists yet. Create one from the Envault web app first.",
    );
    return null;
  }

  const existing = session.getKey(vault.vaultId);
  if (existing) return { key: existing, vault };

  const silent = await trySilentUnlock(context, client, session, vault);
  if (silent) return { key: silent, vault };

  const prompted = await promptUnlock(context, client, session, vault);
  if (prompted) return { key: prompted, vault };

  return null;
}
