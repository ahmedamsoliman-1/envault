import { describe, expect, it } from "vitest";

import type { CryptoProvider } from "./crypto-provider";
import {
  decryptPasswordItem,
  encryptPasswordItem,
  type PasswordAdditionalData,
} from "./payload";

const provider = globalThis.crypto as CryptoProvider;
const vaultKey = new Uint8Array(32).fill(7);
const aad: PasswordAdditionalData = {
  vaultId: "6f00f883-e40e-4415-b9fd-97ead17905f3",
  itemId: "11111111-2222-4333-8444-555555555555",
  encryptionVersion: 1,
};

describe("password item encryption", () => {
  it("round-trips a whole-item plaintext blob", async () => {
    const plaintext = JSON.stringify({
      title: "GitHub",
      url: "https://github.com",
      username: "octocat",
      password: "p@ssw0rd — 日本語",
      notes: "recovery codes inside",
    });
    const payload = await encryptPasswordItem(
      provider,
      vaultKey,
      plaintext,
      aad,
    );
    expect(payload.ciphertext).not.toContain("octocat");
    expect(payload.version).toBe(1);

    await expect(
      decryptPasswordItem(provider, vaultKey, payload, aad),
    ).resolves.toBe(plaintext);
  });

  it("fails to decrypt when the bound item identity changes (AAD)", async () => {
    const payload = await encryptPasswordItem(
      provider,
      vaultKey,
      "secret",
      aad,
    );
    await expect(
      decryptPasswordItem(provider, vaultKey, payload, {
        ...aad,
        itemId: "99999999-2222-4333-8444-555555555555",
      }),
    ).rejects.toThrow();
  });

  it("produces a distinct IV per encryption", async () => {
    const a = await encryptPasswordItem(provider, vaultKey, "same", aad);
    const b = await encryptPasswordItem(provider, vaultKey, "same", aad);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
