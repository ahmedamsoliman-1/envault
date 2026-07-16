import { describe, expect, it } from "vitest";

import type { CryptoProvider } from "../protocol/crypto-provider";
import {
  createVaultKeyMaterial,
  unlockVaultWithPassphrase,
  unlockVaultWithRecoveryKey,
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
