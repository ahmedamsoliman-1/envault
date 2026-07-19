import { base64UrlToBytes, bytesToBase64Url } from "./base64";
import type { CryptoProvider } from "./crypto-provider";
import type { EncryptedPayloadV1 } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface VariableAdditionalData {
  vaultId: string;
  projectId: string;
  environmentId: string;
  variableId: string;
  encryptionVersion: number;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function encodeAdditionalData(data: VariableAdditionalData) {
  return encoder.encode(
    [
      // Legacy AAD label retained after the Envault->Keep rebrand.
      // Do NOT change: it is bound into every existing variable ciphertext.
      "envault",
      "variable",
      "v1",
      data.vaultId,
      data.projectId,
      data.environmentId,
      data.variableId,
      String(data.encryptionVersion),
    ].join(":"),
  );
}

async function importVaultKey(provider: CryptoProvider, vaultKey: Uint8Array) {
  return provider.subtle.importKey(
    "raw",
    toArrayBuffer(vaultKey),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVariableValue(
  provider: CryptoProvider,
  vaultKey: Uint8Array,
  plaintext: string,
  additionalData: VariableAdditionalData,
): Promise<EncryptedPayloadV1> {
  const key = await importVaultKey(provider, vaultKey);
  const iv = provider.getRandomValues(new Uint8Array(12));
  const ciphertext = await provider.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(encodeAdditionalData(additionalData)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(encoder.encode(plaintext)),
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    additionalDataVersion: 1,
  };
}

export async function decryptVariableValue(
  provider: CryptoProvider,
  vaultKey: Uint8Array,
  payload: EncryptedPayloadV1,
  additionalData: VariableAdditionalData,
): Promise<string> {
  const key = await importVaultKey(provider, vaultKey);
  const plaintext = await provider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64UrlToBytes(payload.iv)),
      additionalData: toArrayBuffer(encodeAdditionalData(additionalData)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(base64UrlToBytes(payload.ciphertext)),
  );
  return decoder.decode(plaintext);
}

export interface PasswordAdditionalData {
  vaultId: string;
  itemId: string;
  encryptionVersion: number;
}

function encodePasswordAdditionalData(data: PasswordAdditionalData) {
  // A whole password item (title, url, username, password, notes) is encrypted
  // as one opaque blob. AAD binds the ciphertext to its vault + item identity.
  // This is new data, so it uses a fresh "keep:password" label rather than the
  // frozen legacy "envault:variable" one.
  return encoder.encode(
    [
      "keep",
      "password",
      "v1",
      data.vaultId,
      data.itemId,
      String(data.encryptionVersion),
    ].join(":"),
  );
}

export async function encryptPasswordItem(
  provider: CryptoProvider,
  vaultKey: Uint8Array,
  plaintext: string,
  additionalData: PasswordAdditionalData,
): Promise<EncryptedPayloadV1> {
  const key = await importVaultKey(provider, vaultKey);
  const iv = provider.getRandomValues(new Uint8Array(12));
  const ciphertext = await provider.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(
        encodePasswordAdditionalData(additionalData),
      ),
      tagLength: 128,
    },
    key,
    toArrayBuffer(encoder.encode(plaintext)),
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
    additionalDataVersion: 1,
  };
}

export async function decryptPasswordItem(
  provider: CryptoProvider,
  vaultKey: Uint8Array,
  payload: EncryptedPayloadV1,
  additionalData: PasswordAdditionalData,
): Promise<string> {
  const key = await importVaultKey(provider, vaultKey);
  const plaintext = await provider.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64UrlToBytes(payload.iv)),
      additionalData: toArrayBuffer(
        encodePasswordAdditionalData(additionalData),
      ),
      tagLength: 128,
    },
    key,
    toArrayBuffer(base64UrlToBytes(payload.ciphertext)),
  );
  return decoder.decode(plaintext);
}
