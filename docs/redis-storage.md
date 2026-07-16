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
