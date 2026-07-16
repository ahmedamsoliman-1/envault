import { base64UrlToBytes, bytesToBase64Url } from "../protocol/base64";
import type { CryptoProvider } from "../protocol/crypto-provider";
import type {
  KeyDerivationV1,
  VaultKeyMaterialV1,
  WrappedVaultKeyV1,
} from "../protocol/types";

const textEncoder = new TextEncoder();
const VAULT_KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const RECOVERY_KEY_BYTES = 32;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function wrappingAdditionalData(
  vaultId: string,
  purpose: "passphrase" | "recovery",
) {
  return textEncoder.encode(`envault:v1:vault-key:${vaultId}:${purpose}`);
}

async function deriveWrappingKey(
  provider: CryptoProvider,
  secret: string,
  derivation: KeyDerivationV1,
) {
  const sourceKey = await provider.subtle.importKey(
    "raw",
    toArrayBuffer(textEncoder.encode(secret)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return provider.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(base64UrlToBytes(derivation.salt)),
      iterations: derivation.iterations,
    },
    sourceKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapVaultKey(
  provider: CryptoProvider,
  vaultKey: Uint8Array,
  wrappingKey: CryptoKey,
  vaultId: string,
  purpose: "passphrase" | "recovery",
): Promise<WrappedVaultKeyV1> {
  const iv = provider.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await provider.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(wrappingAdditionalData(vaultId, purpose)),
      tagLength: 128,
    },
    wrappingKey,
    toArrayBuffer(vaultKey),
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    additionalDataVersion: 1,
  };
}

async function unwrapVaultKey(
  provider: CryptoProvider,
  wrappedKey: WrappedVaultKeyV1,
  wrappingKey: CryptoKey,
  vaultId: string,
  purpose: "passphrase" | "recovery",
) {
  const plaintext = await provider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64UrlToBytes(wrappedKey.iv)),
      additionalData: toArrayBuffer(wrappingAdditionalData(vaultId, purpose)),
      tagLength: 128,
    },
    wrappingKey,
    toArrayBuffer(base64UrlToBytes(wrappedKey.ciphertext)),
  );

  return new Uint8Array(plaintext);
}

function createDerivation(
  provider: CryptoProvider,
  iterations: number,
): KeyDerivationV1 {
  return {
    version: 1,
    algorithm: "PBKDF2-SHA-256",
    salt: bytesToBase64Url(
      provider.getRandomValues(new Uint8Array(SALT_BYTES)),
    ),
    iterations,
  };
}

export async function createVaultKeyMaterial(
  provider: CryptoProvider,
  vaultId: string,
  passphrase: string,
  iterations: number,
) {
  if (passphrase.length < 12) {
    throw new Error(
      "The vault passphrase must contain at least 12 characters.",
    );
  }

  const vaultKey = provider.getRandomValues(new Uint8Array(VAULT_KEY_BYTES));
  const recoveryKey = bytesToBase64Url(
    provider.getRandomValues(new Uint8Array(RECOVERY_KEY_BYTES)),
  );
  const passphraseDerivation = createDerivation(provider, iterations);
  const recoveryDerivation = createDerivation(provider, iterations);
  const passphraseWrappingKey = await deriveWrappingKey(
    provider,
    passphrase,
    passphraseDerivation,
  );
  const recoveryWrappingKey = await deriveWrappingKey(
    provider,
    recoveryKey,
    recoveryDerivation,
  );

  const material: VaultKeyMaterialV1 = {
    protocolVersion: 1,
    passphraseDerivation,
    passphraseWrappedKey: await wrapVaultKey(
      provider,
      vaultKey,
      passphraseWrappingKey,
      vaultId,
      "passphrase",
    ),
    recoveryDerivation,
    recoveryWrappedKey: await wrapVaultKey(
      provider,
      vaultKey,
      recoveryWrappingKey,
      vaultId,
      "recovery",
    ),
  };

  return { material, recoveryKey, vaultKey };
}

export async function unlockVaultWithPassphrase(
  provider: CryptoProvider,
  vaultId: string,
  passphrase: string,
  material: VaultKeyMaterialV1,
) {
  const wrappingKey = await deriveWrappingKey(
    provider,
    passphrase,
    material.passphraseDerivation,
  );
  return unwrapVaultKey(
    provider,
    material.passphraseWrappedKey,
    wrappingKey,
    vaultId,
    "passphrase",
  );
}

export async function unlockVaultWithRecoveryKey(
  provider: CryptoProvider,
  vaultId: string,
  recoveryKey: string,
  material: VaultKeyMaterialV1,
) {
  const wrappingKey = await deriveWrappingKey(
    provider,
    recoveryKey,
    material.recoveryDerivation,
  );
  return unwrapVaultKey(
    provider,
    material.recoveryWrappedKey,
    wrappingKey,
    vaultId,
    "recovery",
  );
}
