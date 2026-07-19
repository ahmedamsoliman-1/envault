# Keep Passwords

Keep Passwords is a personal, end-to-end-encrypted password manager built as a
third product area alongside Keep Secrets and Keep Clipboard. The goal is to
become the single source of truth that replaces the scattered browser and app
password stores in use today — grown gradually, useful from day one.

## Security model

Passwords reuse the existing zero-knowledge vault. There is **no server-side
key**: each entry is encrypted client-side with the per-user vault key (the same
key that protects secrets), and the server only ever stores and returns
ciphertext.

- The **whole entry** — title, url, username, password, notes, folder, tags,
  favorite — is encrypted as one opaque blob (`@keephq/crypto`
  `encryptPasswordItem` / `decryptPasswordItem`, AES-256-GCM). The server learns
  nothing about an entry, not even which sites you have accounts on.
- AAD binds each ciphertext to `vaultId + itemId` under a fresh `keep:password`
  label (see `packages/crypto/src/protocol/payload.ts`).
- Search and sort happen in the browser after the vault is unlocked (the
  1Password / Bitwarden model). The page shows a locked state until the vault is
  unlocked from the header control.
- Personal only. Team sharing is a later phase (see Part III backlog).

## Data model

The server stores one opaque record per entry (`PasswordItemDto`):

```
id, vaultId, version, encryptedData, encryptionIv, encryptionVersion,
createdAt, updatedAt
```

`version` gives per-item optimistic concurrency across devices. Entries live in
the existing vault state under the retained `envault:v1` Redis namespace
(`RedisPasswordRepository`, using the same Lua compare-and-set `mutate` helper as
secrets).

## Architecture (mirrors the Secrets slice)

- `packages/api-contract` — `passwordItemDtoSchema`, create/update/import
  schemas, `passwords:read` / `passwords:write` scopes, password error codes.
- `packages/domain` — `PasswordItem` entity + `PasswordRepository` interface.
- `packages/redis` — `RedisPasswordRepository` (list / create / update / delete /
  import), stored on the vault state blob.
- `packages/firebase` — `repositories/password` re-export facade.
- `packages/api-client` — `client.passwords.*`.
- `apps/website` — `/api/v1/passwords[/…]` route handlers (auth → scope →
  parse → repo → result-union → envelope), `/app/passwords` workspace, sidebar
  entry, and `lib/password-entry.ts` for client-side encrypt/decrypt.

## Feature flag

`NEXT_PUBLIC_KEEP_PASSWORDS_ENABLED=true` enables the navigation entry, the
`/app/passwords` route, and the `/api/v1/passwords/*` API. Disabled by default.

## Delivery phases

### Phase P0 — Foundation + core vault

- **P0a (shipped):** contract + scopes + domain + Redis repository + firebase
  facade + api-client + client-side crypto helpers + route handlers + the
  Passwords workspace (unlock gate, add / edit / delete, copy username &
  password, reveal, client-side search) + navigation + feature flag. Unit tests
  cover the crypto round-trip/AAD binding and the repository CRUD + import
  idempotency; `lint` + `typecheck` + `test` are green.
- **P0b (next):** browser-CSV import & cleanup — parse Chrome/Edge/Firefox/
  Safari/Bitwarden/1Password exports in the browser, preview and deselect junk
  rows, encrypt client-side, and commit through `client.passwords.import`
  (idempotent, chunked). Multi-select bulk delete for cleanup.

### Phase P1 — Health & hygiene

Password generator; weak / reused / old analysis (client-side); breach check via
HaveIBeenPwned k-anonymity (range API, never sends a full hash); trash & restore.

### Phase P2 — Richer item types & reach

Secure notes, cards, identities; TOTP codes; folder/tag maturity; surfacing in
VS Code, desktop, and mobile via the existing device-auth + api-client.

### Phase P3 — Sharing

Secure sharing and browser-extension autofill (aligns with the Part III
team/shared backlog).
