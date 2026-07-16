export interface EncryptedPayloadV1 {
  version: 1;
  algorithm: "AES-GCM";
  ciphertext: string;
  iv: string;
  additionalDataVersion: 1;
}

export interface KeyDerivationV1 {
  version: 1;
  algorithm: "PBKDF2-SHA-256";
  salt: string;
  iterations: number;
}

export interface WrappedVaultKeyV1 {
  version: 1;
  algorithm: "AES-GCM";
  ciphertext: string;
  iv: string;
  additionalDataVersion: 1;
}

export interface VaultKeyMaterialV1 {
  protocolVersion: 1;
  passphraseDerivation: KeyDerivationV1;
  passphraseWrappedKey: WrappedVaultKeyV1;
  recoveryDerivation: KeyDerivationV1;
  recoveryWrappedKey: WrappedVaultKeyV1;
}
