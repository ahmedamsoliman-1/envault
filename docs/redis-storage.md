# Redis primary storage

Envault uses Upstash Redis as its primary persistent data store. Firebase remains
only for authentication and ID-token verification.

Configure the server-only Redis connection string:

```dotenv
REDIS_URL="rediss://default:password@your-redis-host:6379"
```

The URL contains the host, port, username, password, and TLS scheme, so a
separate Redis token is not required. Upstash's `rediss://` endpoint works with
the standard Redis protocol client used by Envault.

## Storage model

Every key is isolated below the versioned `envault:v1:` namespace:

- `envault:v1:user:{userId}:vault` maps a Firebase user to a vault.
- `envault:v1:vault:{vaultId}:state` stores the encrypted vault aggregate.
- `envault:v1:session:{sessionId}` stores an opaque application session with TTL.
- `envault:v1:mfa:{userId}` stores the server-encrypted TOTP configuration.
- `envault:v1:mfa-trusted-device:{deviceId}` stores a revocable browser trust
  record with a 30-day TTL.
- `envault:v1:passkey:{credentialId}` stores a public WebAuthn credential.
  When biometric vault unlock is enabled, this record also holds the
  client-encrypted vault-key wrapper and PRF salt; it never holds the plaintext
  vault key or biometric data.
- `envault:v1:user:{userId}:passkeys` indexes a user's passkeys.
- `envault:v1:passkey-challenge:{ceremony}:{flowId}` stores a five-minute
  WebAuthn challenge.
- `envault:v1:passkey-proof:{proofId}` stores a two-minute, one-use bridge from
  verified WebAuthn authentication to Firebase session creation.
- `envault:v1:device-authorization:{authorizationId}` stores a short-lived,
  PKCE-bound browser approval request.
- `envault:v1:device-session:{sessionId}` stores a scoped, revocable external
  client session.
- `envault:v1:device-token:{tokenHash}` maps a hashed bearer token to its
  device session.

Vault mutations use a Lua compare-and-set operation. A mutation reads the
aggregate, applies domain changes, then replaces it only when the stored value
still matches the version that was read. Conflicting writers retry against fresh
state.

Imports and bulk operations are applied once per chunk and retain their
idempotency records inside the aggregate. They do not scan every variable once
per inserted key.

## Migration note

The Redis database begins empty. Existing Firestore data requires a one-time
migration after Firestore quota becomes available. Do not delete the old
Firestore project until encrypted vault metadata and ciphertext have been
verified in Redis.
