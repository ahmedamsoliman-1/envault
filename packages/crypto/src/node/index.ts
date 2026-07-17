import type { CryptoProvider } from "../protocol/crypto-provider";

/**
 * Returns a crypto provider backed by the Node.js Web Crypto implementation.
 *
 * VS Code, the CLI and any other Node client run on the same `globalThis.crypto`
 * Web Crypto surface as the browser, so the protocol implementation is shared
 * without a runtime-specific fork. This adapter only asserts availability and
 * gives callers an explicit, named entry point.
 */
export function getNodeCryptoProvider(): CryptoProvider {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto is not available in this Node.js runtime. Node 20 or newer is required.",
    );
  }
  return globalThis.crypto;
}
