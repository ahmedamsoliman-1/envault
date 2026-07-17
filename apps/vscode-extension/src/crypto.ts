import type { VariableDto } from "@envault/api-contract";
import { decryptVariableValue, encryptVariableValue } from "@envault/crypto";
import { getNodeCryptoProvider } from "@envault/crypto/node";

const provider = getNodeCryptoProvider();

export { provider as cryptoProvider };

/** Decrypts a variable's value locally using the in-memory vault key. */
export async function decryptVariable(
  vaultKey: Uint8Array,
  variable: VariableDto,
): Promise<string> {
  return decryptVariableValue(
    provider,
    vaultKey,
    {
      version: 1,
      algorithm: "AES-GCM",
      ciphertext: variable.encryptedValue,
      iv: variable.encryptionIv,
      additionalDataVersion: 1,
    },
    {
      vaultId: variable.vaultId,
      projectId: variable.projectId,
      environmentId: variable.environmentId,
      variableId: variable.id,
      encryptionVersion: variable.encryptionVersion,
    },
  );
}

export interface EncryptVariableInput {
  vaultId: string;
  projectId: string;
  environmentId: string;
  variableId: string;
  value: string;
}

/** Encrypts a plaintext value locally, returning ciphertext + IV for the API. */
export async function encryptVariable(
  vaultKey: Uint8Array,
  input: EncryptVariableInput,
): Promise<{ encryptedValue: string; encryptionIv: string }> {
  const payload = await encryptVariableValue(provider, vaultKey, input.value, {
    vaultId: input.vaultId,
    projectId: input.projectId,
    environmentId: input.environmentId,
    variableId: input.variableId,
    encryptionVersion: 1,
  });
  return { encryptedValue: payload.ciphertext, encryptionIv: payload.iv };
}
