import { describe, expect, it } from "vitest";

import type { CryptoProvider } from "../protocol/crypto-provider";
import {
  createVaultKeyMaterial,
  unlockVaultWithDeviceSecret,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
  wrapVaultKeyWithDeviceSecret,
} from "./vault-keys";

const provider = globalThis.crypto as CryptoProvider;
const iterations = 600_000;

describe("vault key wrapping", () => {
  it("unwraps the same vault key with passphrase and recovery key", async () => {
    const created = await createVaultKeyMaterial(
      provider,
      "6f00f883-e40e-4415-b9fd-97ead17905f3",
      "a strong vault passphrase",
      iterations,
    );

    const passphraseKey = await unlockVaultWithPassphrase(
      provider,
      "6f00f883-e40e-4415-b9fd-97ead17905f3",
      "a strong vault passphrase",
      created.material,
    );
    const recoveryKey = await unlockVaultWithRecoveryKey(
      provider,
      "6f00f883-e40e-4415-b9fd-97ead17905f3",
      created.recoveryKey,
      created.material,
    );

    expect(passphraseKey).toEqual(created.vaultKey);
    expect(recoveryKey).toEqual(created.vaultKey);
  });

  it("rejects an incorrect passphrase", async () => {
    const created = await createVaultKeyMaterial(
      provider,
      "251f464d-19e3-43f9-94ae-735162d36153",
      "the correct vault passphrase",
      iterations,
    );

    await expect(
      unlockVaultWithPassphrase(
        provider,
        "251f464d-19e3-43f9-94ae-735162d36153",
        "the incorrect passphrase",
        created.material,
      ),
    ).rejects.toThrow();
  });

  it("unwraps the vault key with a device secret and rejects the wrong one", async () => {
    const vaultId = "b4e3f0a1-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
    const created = await createVaultKeyMaterial(
      provider,
      vaultId,
      "a strong vault passphrase",
      iterations,
    );
    const deviceSecret = provider.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapVaultKeyWithDeviceSecret(
      provider,
      vaultId,
      created.vaultKey,
      deviceSecret,
    );

    const unwrapped = await unlockVaultWithDeviceSecret(
      provider,
      vaultId,
      wrapped,
      deviceSecret,
    );
    expect(unwrapped).toEqual(created.vaultKey);

    const wrongSecret = provider.getRandomValues(new Uint8Array(32));
    await expect(
      unlockVaultWithDeviceSecret(provider, vaultId, wrapped, wrongSecret),
    ).rejects.toThrow();
  });

  it("uses unique salts and IVs", async () => {
    const first = await createVaultKeyMaterial(
      provider,
      "19fa8fd0-92f9-4f34-89f7-92d27277e183",
      "a strong vault passphrase",
      iterations,
    );
    const second = await createVaultKeyMaterial(
      provider,
      "19fa8fd0-92f9-4f34-89f7-92d27277e183",
      "a strong vault passphrase",
      iterations,
    );

    expect(first.material.passphraseDerivation.salt).not.toBe(
      second.material.passphraseDerivation.salt,
    );
    expect(first.material.passphraseWrappedKey.iv).not.toBe(
      second.material.passphraseWrappedKey.iv,
    );
  });
});
