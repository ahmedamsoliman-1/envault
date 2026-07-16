import type { CryptoProvider } from "../protocol/crypto-provider";

export function getBrowserCryptoProvider(): CryptoProvider {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available in this browser.");
  }
  return globalThis.crypto;
}
