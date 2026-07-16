export interface EncryptedPayloadV1 {
  version: 1;
  algorithm: "AES-GCM";
  ciphertext: string;
  iv: string;
  additionalDataVersion: 1;
}
