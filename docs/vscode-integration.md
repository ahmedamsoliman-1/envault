# VS Code extension integration

The `apps/vscode-extension` client consumes the same `/api/v1` surface, typed API
client, shared contracts and encryption protocol as the website. It never
connects directly to Redis or Firebase.

## Authentication

Sign-in uses browser-approved device authorization with PKCE
(`docs/device-authorization.md`). The resulting revocable device token is stored
only in VS Code `SecretStorage` and sent as `Authorization: Bearer <token>`.

Reads (`projects:read`, `environments:read`, `variables:read`) and the vault
status endpoint accept device tokens. Writes require `variables:write`; the
import route authorizes device tokens through `getWriteAccess`, which skips the
browser trusted-origin (CSRF) check for token-authenticated requests because a
Bearer token carries no ambient authority.

## Local decryption

The extension unlocks the vault locally, exactly like the website:

1. `GET /api/v1/vault` returns the wrapped key material (safe to expose to an
   owner-scoped device session — it is encrypted and useless without the
   passphrase or recovery key).
2. `unlockVaultWithPassphrase` / `unlockVaultWithRecoveryKey` derive and unwrap
   the vault key using `@envault/crypto` with the Node crypto provider
   (`@envault/crypto/node`).
3. The unwrapped key is held in memory only and cleared on lock, sign-out,
   auto-lock and window close.

Values are decrypted (pull) and encrypted (push) locally with
`decryptVariableValue` / `encryptVariableValue`. Plaintext never reaches the
server.

## Silent unlock (device-wrapped key)

So the passphrase is entered at most once per device:

1. On first unlock the extension generates a random 32-byte device secret, wraps
   the vault key with it (`wrapVaultKeyWithDeviceSecret`, AAD purpose `device`),
   and stores the secret in `SecretStorage`.
2. The wrapped material is persisted server-side, bound to the device session:

   ```text
   GET    /api/v1/device/vault-key   → { wrapped: { vaultId, wrappedKey } | null }
   PUT    /api/v1/device/vault-key   ← { vaultId, wrappedKey }
   DELETE /api/v1/device/vault-key
   ```

   Only ciphertext and IV are stored — never the device secret or any plaintext.
3. Later sessions fetch the wrapped material and combine it with the local
   device secret to unwrap silently.
4. Revoking the device session removes the wrapped-key record, so a revoked
   device can no longer unlock silently and falls back to the passphrase.

## Push concurrency safety

Push classifies the local `.env` against remote variables (create / update /
unchanged / invalid) and never deletes: keys present only remotely are reported
and left untouched. Updates reuse the remote variable id (the import route
rejects a key/id mismatch). Commits go through `POST
/api/v1/environments/:id/import` with an expected version and a per-chunk
idempotency `operationId`. A stale push returns `409
ENVIRONMENT_VERSION_CONFLICT`, after which the user can overwrite (re-plan against
the latest version, local wins) or compare & merge.
