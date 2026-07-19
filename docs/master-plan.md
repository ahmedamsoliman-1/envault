# Keep — Secure Developer Sync Platform (Master Plan)

> **Keep — Your secrets and clipboard, protected and in sync across every device.**

Keep is an API-first, client-side-encrypted platform for the sensitive text a
developer carries between machines. It has two capabilities under one backend,
one identity, and one device model:

- **Keep Secrets** — encrypted environment-variable and secret management across
  projects and environments (formerly _Envault_).
- **Keep Clipboard** — secure cross-device clipboard synchronization.

This document is the **single source of truth**. It supersedes and replaces the
former `Plan.md` (the Envault platform spec) and `ClipboardSyncPlan.md` (the
clipboard feature spec), both now removed.

## How to read this document

- **Part 0 — Rebrand: Envault → Keep.** The naming decision, the exact rename
  map, the mechanical migration checklist, and the caveats. Do this first; all
  later code is born as _Keep_.
- **Part I — Keep Secrets (the platform).** The original Envault platform spec,
  folded in and rebranded verbatim, **including the real delivery-phase
  completion state** (`[x]`/`[ ]`). This is history + remaining roadmap; do not
  lose the checkbox state.
- **Part II — Keep Clipboard.** The clipboard spec, reconciled to what the repo
  _actually_ has today (device authorization, Redis, crypto, shared packages),
  then the full rebranded feature spec.
- **Part III — Unified delivery roadmap.** What is done, what the current
  divergence is, and the order of return.

> **Current intent (2026-07):** intentionally diverge from the platform roadmap
> to ship **Keep Clipboard Phase 1 + 2** (BFF/web core + VS Code), behind a
> feature flag, then return to the unfinished platform work (Part I: revision
> history Stage E, activity Stage F, Phase 10 hardening).

---

# Part 0 — Rebrand: Envault → Keep

## 0.1 Why rebrand

"Envault" is `env + vault` — the name is bound to environment variables. Adding
cross-device clipboard sync makes the product broader than env vars: it is a
client-side-encrypted store for _any_ sensitive developer text that moves
between environments and devices. The **`en-` (env) prefix is the limiting
part**, not "vault". We keep the trust the product has earned and drop the
env-specificity. The umbrella becomes **Keep**, expressed as two sub-brands:
**Keep Secrets** and **Keep Clipboard**.

This honors the original clipboard spec's rule ("one backend, one brand"): we
are not creating a second product or backend — we are renaming the _umbrella_
and giving each capability a sub-brand under the same BFF, identity, Redis, and
device model.

## 0.2 Caveats (accepted)

- **Trademark / search collision:** "Keep" collides with Google Keep and is a
  common English word, so the plain domain and the `@keep` npm scope are almost
  certainly unavailable. This is accepted. We use a **qualified package scope
  `@keephq/*`** and a **`KEEP_` env prefix**. Revisit the public trademark later
  if it becomes a problem; the rename is mechanical and can be redone.

## 0.3 Rename map

| Concept                       | Before                                               | After                                       |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Product name (prose, UI)      | Envault                                              | Keep                                        |
| Sub-brands                    | —                                                    | Keep Secrets, Keep Clipboard                |
| npm workspace scope           | `@envault/*`                                         | `@keephq/*`                                 |
| VS Code app package           | `envault-vscode`                                     | `keep-vscode`                               |
| VS Code command prefix        | `Envault: …`                                         | `Keep: …`                                   |
| Typed client class            | `EnvaultClient`                                      | `KeepClient`                                |
| Redis client type / helpers   | `EnvaultRedis`, `envaultRedisKey`, `getEnvaultRedis` | `KeepRedis`, `keepRedisKey`, `getKeepRedis` |
| Redis key prefix (VALUE)      | `envault:v1`                                         | **`envault:v1` — retained** (see 0.6)       |
| Crypto AAD labels (VALUE)     | `envault:…`, `envault:v1:vault-key:…`                | **retained** — bound to ciphertext (0.6)    |
| Env-var prefix                | `ENVAULT_*`                                          | `KEEP_*`                                    |
| Session cookie (VALUE)        | `envault_session`                                    | **`envault_session` — retained** (0.6)      |
| MFA-trust cookie (VALUE)      | `envault_mfa_trust`                                  | **`envault_mfa_trust` — retained** (0.6)    |
| App name env                  | `NEXT_PUBLIC_APP_NAME=Envault`                       | `NEXT_PUBLIC_APP_NAME=Keep`                 |
| Device type union (clipboard) | `EnvaultDevice`                                      | `KeepDevice`                                |
| Monorepo root dir             | `envault/`                                           | `keep/`                                     |

## 0.4 Migration checklist — Step 0 (one isolated commit, no behavior change)

- [x] Rename all `@envault/*` package `name` fields to `@keephq/*` and update
      every import specifier across `apps/*` and `packages/*`.
- [x] `packages/redis/src/index.ts`: rename symbols `envaultRedisKey` →
      `keepRedisKey`, `getEnvaultRedis` → `getKeepRedis`, `EnvaultRedis` →
      `KeepRedis`, `ENVAULT_REDIS_PREFIX` → `KEEP_REDIS_PREFIX`. **Keep the
      VALUE `"envault:v1"`** (see 0.6 — bound to existing keys).
- [x] Rename `ENVAULT_*` env-var _names_ to `KEEP_*`. **Do not change the
      cookie VALUES** (`SESSION_COOKIE_NAME=envault_session`) — see 0.6.
- [x] Cookie symbol references renamed; **VALUES retained** as
      `envault_session` / `envault_mfa_trust` (0.6).
- [x] Rename the VS Code app dir/package `envault-vscode` → `keep-vscode`,
      command titles `Envault: …` → `Keep: …`, command ids `envault.*` →
      `keep.*`, and `activationEvents`. **Exception:** SecretStorage/workspace
      keys (`envault.deviceAccessToken`, `envault.deviceVaultSecret`,
      `envault.binding:*`) keep their legacy VALUES so existing device pairings
      survive (0.6).
- [x] Replace user-facing "Envault" strings with "Keep" in the website and
      extension.
- [x] Run `pnpm check` (lint + typecheck + test + build) and confirm green.

## 0.6 Data continuity — legacy internal namespaces are RETAINED (decision, 2026-07-18)

Several _internal_ identifiers are bound to already-persisted data. Renaming
their VALUES orphaned it (the first rebrand pass did exactly this and made the
existing vault, projects, environments and sessions invisible/undecryptable).
**Resolution: keep the new `KEEP_*` symbol _names_, but restore the legacy
string _values_.** No data migration, no re-login. These strings are invisible
to users; loud `// Do NOT change` comments guard them in code.

| Identifier                      | File                                             | Retained value                                                                |
| ------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Redis key prefix                | `packages/redis/src/index.ts`                    | `envault:v1`                                                                  |
| Variable-payload AAD label      | `packages/crypto/src/protocol/payload.ts`        | `envault` (`envault:variable:v1:…`)                                           |
| Wrapped-vault-key AAD label     | `packages/crypto/src/key-wrapping/vault-keys.ts` | `envault:v1:vault-key:…`                                                      |
| Session cookie name             | `packages/config/src/server.ts`                  | `envault_session`                                                             |
| MFA-trust cookie name           | `auth/session/route.ts`, `lib/firebase-admin.ts` | `envault_mfa_trust`                                                           |
| VS Code SecretStorage / binding | `apps/vscode-extension/src/*`                    | `envault.deviceAccessToken`, `envault.deviceVaultSecret`, `envault.binding:*` |

**Why the crypto labels are non-negotiable:** they are AES-256-GCM _associated
data_ baked into every ciphertext. Changing them fails auth-tag verification, so
existing variables cannot be decrypted and existing vaults cannot be unlocked.

**Consequence for Keep Clipboard (Part II):** new clipboard keys live under the
retained prefix — **`envault:v1:clipboard:*`**, not `keep:v1:clipboard:*`.
Wherever Part II says `keep:v1`, read `envault:v1`.

## 0.5 Storage note (Firestore → Redis)

The original platform spec (Part I) was written around **Cloud Firestore** as
the primary database. The codebase has since moved to **Redis as primary
storage** (see `docs/redis-storage.md`, `@keephq/redis`, and the
"Atomic Redis compare-and-set" / "non-sensitive Redis overview" items already
checked off in the Part I phases). Treat Firestore references in Part I as
**historical spec**: where they conflict with the shipped Redis implementation,
the Redis implementation wins. Keep Clipboard (Part II) targets Redis directly
and does not reintroduce Firestore.

---

# Part I — Keep Secrets (the platform)

> Folded from the former `Plan.md` and rebranded (Envault → Keep). Section
> numbering and the **delivery-phase completion state (`[x]`/`[]`) are preserved
> verbatim** — this is both the historical spec and the remaining platform
> roadmap. Per Part 0.5, read Firestore references as historical where the repo
> now uses Redis.

---

# Keep — Secure Environment Variable Management Platform

You are a senior full-stack engineer, software architect, security engineer and product designer.

Build a production-quality platform called **Keep**.

> **Keep — Your environments, organized and protected.**

Keep allows developers to securely manage environment variables and secrets across multiple projects and environments.

The initial product is a modern Next.js web application. However, the architecture must support future clients such as:

- A VS Code extension.
- A command-line interface.
- A desktop application.
- Other approved integrations.

Do not create a superficial prototype. Build a maintainable, typed, testable and security-conscious application.

---

# 1. Core product requirements

Users must be able to:

- Register using email and password.
- Verify their email address.
- Log in and log out.
- Reset their password.
- Enable TOTP multi-factor authentication.
- Use authenticator applications such as Microsoft Authenticator or Google Authenticator.
- Complete an MFA challenge during login.
- Create and unlock an encrypted vault.
- Create multiple projects.
- Create multiple environments under each project.
- Add, edit, rename, copy and delete environment variables.
- Hide sensitive values by default.
- Reveal values temporarily.
- Copy values to the clipboard.
- Import `.env` files and pasted dotenv content.
- Export environments in supported formats.
- Search and filter variables.
- Select multiple variables.
- Perform bulk updates.
- Copy variables between environments.
- Compare two environments.
- View revision history.
- Restore previous revisions.
- Review non-sensitive activity logs.
- Configure automatic vault locking.
- Use light and dark themes.

The first release is for individual users.

Do not implement team collaboration yet, but structure the platform so organizations, memberships, roles and shared vaults can be added later.

---

# 2. Required technology stack

Use:

- Next.js with the App Router.
- React.
- TypeScript with strict mode.
- `pnpm`.
- A `pnpm` workspace.
- Turborepo where useful.
- Tailwind CSS.
- shadcn/ui.
- Radix UI primitives.
- Lucide icons.
- Firebase Authentication.
- Firebase Authentication with Identity Platform.
- Cloud Firestore.
- Firebase Admin SDK.
- Firebase App Check integration points.
- Firebase Emulator Suite.
- Zod.
- React Hook Form.
- TanStack Table.
- Sonner.
- Vitest.
- Playwright.
- Firestore Rules Unit Testing.

Do not introduce another primary database.

Do not use Redux unless there is a strong architectural requirement.

---

# 3. Architecture requirements

Keep must use an **API-first, multi-client architecture**.

The initial web application uses Next.js, but the platform must not be designed as a web-only Firestore application.

Use Next.js Route Handlers as:

- A Backend for Frontend for the website.
- A versioned application API for future clients.
- An authorization boundary.
- A validation boundary.
- A stable interface over Firestore.

The website must not directly access Firestore for core domain operations.

Firestore access should occur through server-side repositories and application services.

The architecture should follow:

```text
Next.js Website
       │
       │ HTTPS / typed API client
       ▼
Next.js Route Handlers — /api/v1
       │
       ▼
Application Services
       │
       ▼
Domain Layer
       │
       ▼
Firestore Repositories
       │
       ▼
Cloud Firestore
```

Future clients should follow:

```text
VS Code Extension
       │
       │ HTTPS / typed API client
       ▼
Keep /api/v1
```

Do not place important business logic directly inside:

- React components.
- Route Handlers.
- Server Actions.
- Firestore repositories.

Route Handlers should handle only:

- Authentication.
- Authorization context.
- Request parsing.
- Input validation.
- Application-service invocation.
- Error-to-HTTP mapping.
- Typed responses.

---

# 4. Monorepo structure

Use a structure similar to:

```text
keep/
├── apps/
│   ├── website/
│   │   └── Next.js application
│   │
│   └── vscode-extension/
│       └── Reserved for future implementation
│
├── packages/
│   ├── domain/
│   │   ├── projects/
│   │   ├── environments/
│   │   ├── variables/
│   │   ├── revisions/
│   │   ├── devices/
│   │   └── common/
│   │
│   ├── application/
│   │   ├── projects/
│   │   ├── environments/
│   │   ├── variables/
│   │   ├── imports/
│   │   ├── exports/
│   │   ├── comparisons/
│   │   └── device-sessions/
│   │
│   ├── api-contract/
│   │   ├── schemas/
│   │   ├── requests/
│   │   ├── responses/
│   │   ├── errors/
│   │   └── versioning/
│   │
│   ├── api-client/
│   │   ├── client.ts
│   │   ├── projects.ts
│   │   ├── environments.ts
│   │   ├── variables.ts
│   │   ├── devices.ts
│   │   └── errors.ts
│   │
│   ├── crypto/
│   │   ├── protocol/
│   │   ├── browser/
│   │   ├── node/
│   │   ├── key-wrapping/
│   │   └── recovery/
│   │
│   ├── dotenv/
│   │   ├── parser/
│   │   ├── serializer/
│   │   ├── validation/
│   │   └── comparison/
│   │
│   ├── firebase/
│   │   ├── admin/
│   │   ├── client/
│   │   ├── repositories/
│   │   └── converters/
│   │
│   ├── config/
│   ├── logger/
│   └── test-utils/
│
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── firebase.json
│
├── docs/
│   ├── architecture.md
│   ├── encryption.md
│   ├── threat-model.md
│   ├── api.md
│   ├── device-authorization.md
│   └── decisions/
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

The `apps/vscode-extension` application does not need to be fully implemented in the initial release, but the shared packages and APIs must make it possible to add later without redesigning the platform.

---

# 5. API design

Expose a versioned API under:

```text
/api/v1
```

Create endpoints similar to:

```text
/api/v1/auth/session
/api/v1/auth/reauthenticate

/api/v1/vault
/api/v1/vault/status
/api/v1/vault/settings

/api/v1/projects
/api/v1/projects/:projectId

/api/v1/projects/:projectId/environments
/api/v1/environments/:environmentId
/api/v1/environments/:environmentId/variables
/api/v1/environments/:environmentId/changes
/api/v1/environments/:environmentId/import
/api/v1/environments/:environmentId/export
/api/v1/environments/:environmentId/compare
/api/v1/environments/:environmentId/revisions

/api/v1/variables/:variableId
/api/v1/variables/:variableId/revisions
/api/v1/revisions/:revisionId/restore

/api/v1/activity

/api/v1/device-authorizations
/api/v1/device-authorizations/:authorizationId
/api/v1/device-sessions
/api/v1/device-sessions/:sessionId
/api/v1/device-sessions/:sessionId/revoke
```

Use consistent JSON response envelopes.

Example success response:

```json
{
  "data": {
    "id": "environment-id",
    "name": "Development"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```

Example error response:

```json
{
  "error": {
    "code": "ENVIRONMENT_VERSION_CONFLICT",
    "message": "The environment was modified by another client.",
    "details": {
      "expectedVersion": 17,
      "currentVersion": 19
    }
  },
  "meta": {
    "requestId": "request-id"
  }
}
```

Use stable machine-readable error codes.

---

# 6. Shared API contracts

All API inputs and outputs must use shared Zod schemas from:

```text
packages/api-contract
```

Example:

```typescript
import { z } from "zod";

export const variableDtoSchema = z.object({
  id: z.string(),
  vaultId: z.string(),
  projectId: z.string(),
  environmentId: z.string(),

  key: z.string(),
  encryptedValue: z.string(),
  encryptionIv: z.string(),
  encryptionVersion: z.number().int(),

  visibility: z.enum(["secret", "protected", "plain"]),
  tags: z.array(z.string()),
  description: z.string().nullable(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type VariableDto = z.infer<typeof variableDtoSchema>;
```

The schemas must be consumed by:

- Route Handlers.
- The website.
- The typed API client.
- Future VS Code extension.
- Future CLI.
- Tests.

Do not manually duplicate request or response types.

---

# 7. Typed API client

Create a reusable client in:

```text
packages/api-client
```

Example usage:

```typescript
const client = new KeepClient({
  baseUrl: process.env.NEXT_PUBLIC_APP_URL,
  getAccessToken: async () => tokenProvider.getAccessToken(),
});

const environment = await client.environments.get(environmentId);

await client.environments.applyChanges(environmentId, {
  expectedVersion: environment.version,
  changes: [
    {
      operation: "upsert",
      variable: encryptedVariable,
    },
  ],
});
```

The website should consume the same client intended for future VS Code and CLI clients.

Do not allow the web application to use undocumented private Firestore behavior that future clients cannot access.

---

# 8. Encryption architecture

Keep must use client-side encryption.

Plaintext environment-variable values must never be sent to Firestore or the Keep API.

The flow is:

```text
Plaintext entered in client
        │
        ▼
Encrypted locally
        │
        ▼
Ciphertext sent through /api/v1
        │
        ▼
Ciphertext stored in Firestore
```

For reads:

```text
Ciphertext retrieved through /api/v1
        │
        ▼
Ciphertext decrypted locally
        │
        ▼
Plaintext displayed temporarily
```

The server must not have the ability to decrypt user secrets.

---

# 9. Shared encryption protocol

Implement the encryption protocol in:

```text
packages/crypto
```

The encryption protocol must be runtime-independent.

Provide separate adapters for:

```text
Browser → Web Crypto API
Node.js / VS Code → Node Web Crypto API
```

Both adapters must produce compatible ciphertext.

Define versioned encrypted payloads.

Example:

```typescript
interface EncryptedPayloadV1 {
  version: 1;
  algorithm: "AES-GCM";
  ciphertext: string;
  iv: string;
  additionalDataVersion: 1;
}
```

Use:

- AES-256-GCM for payload encryption.
- A cryptographically secure random IV for every encryption operation.
- A separate random vault data-encryption key.
- PBKDF2-SHA-256 for initial passphrase-based key derivation.
- A unique random salt per user.
- A configurable and documented iteration count.
- Authenticated additional data.

Authenticated additional data should include stable identifiers:

```text
vaultId
projectId
environmentId
variableId
encryptionVersion
```

Never reuse an IV with the same encryption key.

Never create custom cryptographic primitives.

---

# 10. Vault passphrase

Firebase does not expose the user’s authentication password.

Therefore, users must create a separate vault passphrase.

During vault setup:

1. Generate a random vault encryption key.
2. Derive a key-encryption key from the vault passphrase.
3. Wrap the vault encryption key using AES-GCM.
4. Store only the wrapped vault key and derivation metadata.
5. Keep the unlocked vault key only in memory.
6. Clear it when:

   - The vault is manually locked.
   - The user signs out.
   - The auto-lock timer expires.
   - The page is closed where practical.
   - Authentication becomes invalid.

Never store the vault passphrase.

Never store an unwrapped vault key in:

- Firestore.
- Cookies.
- localStorage.
- sessionStorage.
- IndexedDB.
- Logs.
- Analytics.

---

# 11. Recovery key

During vault creation:

- Generate a high-entropy recovery key.
- Display it once.
- Require the user to confirm it has been saved.
- Use it to create a second wrapped copy of the vault key.
- Do not store the raw recovery key.

Clearly explain:

- Firebase password reset does not reset the vault passphrase.
- Loss of both the passphrase and recovery key means encrypted data cannot be recovered.
- Keep administrators cannot decrypt the vault.

Do not create an administrative decryption backdoor.

---

# 12. Authentication requirements

Use Firebase Authentication.

Implement:

- Email and password registration.
- Email verification.
- Login.
- Logout.
- Password reset.
- Authentication-state restoration.
- Session revocation behavior.
- Recent-login checks.
- Reauthentication for sensitive operations.
- TOTP MFA enrollment.
- TOTP MFA challenge.
- TOTP MFA removal.
- Clear error handling.

Users may register before verifying their email, but unverified users must not be able to:

- Create a vault.
- Read vault metadata.
- Read projects.
- Read environments.
- Read ciphertext.
- Create or update vault data.

Create a dedicated verification page with:

- Verification status.
- Resend verification email.
- Refresh verification state.
- Change account action.
- Logout action.

---

# 13. TOTP MFA

Use Firebase Authentication with Identity Platform.

Support authenticator applications including:

- Microsoft Authenticator.
- Google Authenticator.
- Authy.
- Compatible TOTP applications.

The enrollment flow should include:

1. Reauthentication.
2. TOTP secret generation.
3. QR code display.
4. Manual setup key.
5. Verification-code input.
6. Enrollment confirmation.
7. Security-status update.

During login:

1. Detect that MFA is required.
2. Preserve the Firebase multi-factor resolver.
3. Show an MFA challenge page.
4. Accept a TOTP code.
5. Resolve the sign-in.
6. Establish the application session.

Do not collect Firebase passwords inside future VS Code extension UI.

---

# 14. Web session architecture

Use secure server-side session handling appropriate for Next.js.

The web flow should be:

```text
Firebase client authentication
        │
        ▼
Firebase ID token
        │
        ▼
Secure session exchange endpoint
        │
        ▼
HTTP-only secure session cookie
        │
        ▼
Server-side verification using Firebase Admin SDK
```

Use:

- HTTP-only cookies.
- Secure cookies in production.
- SameSite settings.
- CSRF protection for state-changing browser requests.
- Session expiration.
- Session revocation checks where appropriate.

Do not rely only on client-side React authentication state.

---

# 15. Future VS Code extension authentication

Prepare the platform for browser-based device authorization.

The expected future flow is:

```text
1. User runs “Keep: Sign In” in VS Code.
2. Extension creates a device authorization.
3. Extension opens the system browser.
4. User signs in through the Keep website.
5. User completes Firebase MFA.
6. User approves the device.
7. Extension exchanges a short-lived authorization code.
8. Extension receives a revocable device session.
9. Extension stores credentials in VS Code SecretStorage.
```

The extension must never request or store:

- Firebase password.
- TOTP secret.
- Raw recovery key.
- Long-lived unprotected credentials.

Reserve and document the required API endpoints:

```text
POST /api/v1/device-authorizations
GET  /api/v1/device-authorizations/:id
POST /api/v1/device-authorizations/:id/approve
POST /api/v1/device-authorizations/:id/exchange

GET    /api/v1/device-sessions
DELETE /api/v1/device-sessions/:id
```

Device authorization codes must be:

- Short-lived.
- Single-use.
- Random.
- Hashed before persistence.
- Bound to the requesting client.
- Invalidated after exchange.

---

# 16. Device sessions

Design a device-session model.

Each device session should include:

```typescript
interface DeviceSession {
  id: string;
  ownerId: string;
  vaultId: string;

  name: string;
  clientType: "web" | "vscode" | "cli" | "desktop";
  clientVersion: string | null;
  platform: string | null;

  scopes: string[];

  createdAt: Timestamp;
  lastUsedAt: Timestamp;
  expiresAt: Timestamp;
  revokedAt: Timestamp | null;
}
```

Users must be able to review and revoke device sessions from the web application.

Support scopes such as:

```text
projects:read
environments:read
variables:read
variables:write
environments:export
environments:sync
```

Start with a simple scope model, but do not issue unrestricted permanent tokens.

---

# 17. Future VS Code vault unlocking

The VS Code extension must decrypt ciphertext locally.

The extension should use the shared `packages/crypto` protocol.

On first use, it may ask the user for:

- Their vault passphrase.
- Or their recovery key.

Optional future convenience:

- Create a device-specific wrapped vault key.
- Store only the device-wrapped material in VS Code SecretStorage.
- Allow the user to revoke the device from Keep.
- Invalidate the device-specific wrapping record when revoked.

Do not store an unwrapped vault key in the extension’s normal settings or workspace files.

---

# 18. Optimistic concurrency

The website, VS Code extension and future CLI may update the same environment.

Every environment must have:

```typescript
interface EnvironmentVersion {
  version: number;
  contentRevision: string;
  updatedAt: Timestamp;
}
```

Every mutating request must include an expected version.

Example:

```json
{
  "expectedVersion": 17,
  "changes": [
    {
      "operation": "upsert",
      "variable": {
        "key": "API_URL",
        "encryptedValue": "ciphertext",
        "encryptionIv": "iv"
      }
    }
  ]
}
```

If the environment version has changed, return:

```http
409 Conflict
```

With:

```json
{
  "error": {
    "code": "ENVIRONMENT_VERSION_CONFLICT",
    "message": "The environment was changed by another client.",
    "details": {
      "expectedVersion": 17,
      "currentVersion": 19
    }
  }
}
```

Do not silently overwrite newer changes.

Use Firestore transactions for version checks and updates.

---

# 19. Idempotency

Support idempotency for important mutation requests, especially:

- Bulk updates.
- Imports.
- Synchronization.
- Device authorization exchange.
- Revision restore.

Allow clients to send:

```http
Idempotency-Key: unique-operation-id
```

Store a safe operation record so retries do not duplicate writes.

Do not store plaintext values in operation records.

---

# 20. Projects and environments

A project can contain multiple environments.

Example:

```text
Cosmos
├── Local
├── Development
├── Staging
└── Production
```

Project actions:

- Create.
- Update.
- Rename.
- Archive.
- Restore.
- Duplicate.
- Delete.

Environment actions:

- Create.
- Update.
- Rename.
- Duplicate.
- Archive.
- Restore.
- Delete.
- Import.
- Export.
- Compare.
- Synchronize.
- Copy selected variables.

Environment kinds:

```typescript
type EnvironmentKind =
  "local" | "development" | "testing" | "staging" | "production" | "custom";
```

Production environments should have a clear warning treatment.

Sensitive production operations may require:

- Recent authentication.
- MFA.
- Confirmation using the environment name.

---

# 21. Variable model

Each variable should include:

```typescript
interface Variable {
  id: string;
  ownerId: string;
  vaultId: string;
  projectId: string;
  environmentId: string;

  key: string;
  normalizedKey: string;

  encryptedValue: string;
  encryptionIv: string;
  encryptionVersion: number;

  visibility: "secret" | "protected" | "plain";

  tags: string[];
  description: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

All values should be encrypted, including values classified as plain.

The visibility classification controls interface behavior, not storage encryption.

---

# 22. Variable editor

Build a high-quality environment editor using TanStack Table.

Columns:

- Selection.
- Key.
- Masked value.
- Visibility.
- Tags.
- Updated time.
- Actions.

Support:

- Inline editing.
- Keyboard navigation.
- Add-variable dialog.
- Search.
- Sorting.
- Filtering.
- Tag filtering.
- Visibility filtering.
- Pagination or virtualization.
- Optimistic UI.
- Safe rollback.
- Copy key.
- Copy value.
- Reveal temporarily.
- Rename.
- Duplicate.
- Copy to another environment.
- View revisions.
- Delete.

Secret values must be masked by default.

Do not place plaintext values in:

- HTML title attributes.
- URL query parameters.
- Analytics events.
- Error reports.
- Browser logs.

---

# 23. Bulk operations

Users must be able to select variables and:

- Delete them.
- Copy them.
- Move them.
- Add tags.
- Remove tags.
- Change visibility.
- Add a prefix.
- Remove a prefix.
- Convert keys to uppercase.
- Find and replace key text.
- Export selected variables.

Create a spreadsheet-style bulk editor.

The user should be able to paste:

```dotenv
API_URL=https://api.example.com
LOG_LEVEL=debug
FEATURE_NEW_HOME=true
```

Before committing, show:

```text
New variables: 12
Updated variables: 4
Unchanged variables: 8
Invalid variables: 2
Conflicts: 3
```

Conflict policies:

- Overwrite existing variables.
- Skip existing variables.
- Import only new variables.
- Review conflicts individually.

Chunk large operations safely.

Return progress information.

Use idempotency keys.

Use expected environment versions.

---

# 24. Import formats

Support:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- Pasted dotenv content.
- JSON objects.
- Shell-style `export KEY=value`.

Support:

- Empty values.
- Quoted values.
- Escaped characters.
- Comments.
- Duplicate-key detection.
- Variable-reference preservation.
- Safely parseable multiline values.

Do not execute:

- Shell commands.
- Command substitutions.
- JavaScript.
- Templates.
- Arbitrary expressions.

Treat suspicious content as literal text and show a warning.

---

# 25. Export formats

Support:

- `.env`
- JSON.
- Shell exports.
- Docker Compose environment snippet.
- Kubernetes Secret YAML.

Export must occur locally after decryption.

Do not send plaintext export content to the server.

Do not store generated exports in Firestore.

Clearly explain that Kubernetes base64 values are encoded, not encrypted.

---

# 26. Environment comparison

Allow users to compare any two environments.

Classify variables as:

- Identical.
- Different value.
- Missing from source.
- Missing from destination.
- Different visibility.
- Different tags or metadata.

Support:

- Copy source to destination.
- Copy destination to source.
- Synchronize selected.
- Ignore selected differences.
- Export a difference report.

Comparison should occur locally after decrypting ciphertext.

Do not persist plaintext comparison results.

---

# 27. Revision history

Create revisions for:

- Variable creation.
- Value update.
- Key rename.
- Visibility update.
- Metadata update.
- Deletion.
- Restoration.

Any revision snapshot containing a value must be encrypted.

Do not decrypt all revision values when loading the history list.

Decrypt only the selected revision.

Restoring a revision must create a new revision rather than rewriting history.

---

# 28. Firestore collections

Use a model similar to:

```text
users/{userId}

vaults/{vaultId}
vaults/{vaultId}/projects/{projectId}
vaults/{vaultId}/environments/{environmentId}
vaults/{vaultId}/variables/{variableId}
vaults/{vaultId}/revisions/{revisionId}
vaults/{vaultId}/activity/{activityId}
vaults/{vaultId}/operations/{operationId}
vaults/{vaultId}/deviceSessions/{deviceSessionId}
vaults/{vaultId}/deviceAuthorizations/{authorizationId}
```

All vault-owned documents must include:

```typescript
ownerId: string;
vaultId: string;
createdAt: Timestamp;
updatedAt: Timestamp;
```

Use server timestamps where appropriate.

Document all required Firestore indexes.

---

# 29. Firestore Security Rules

Create strict Firestore Security Rules even though core application access uses server-side repositories.

Rules must:

- Deny unauthenticated access.
- Deny access for unverified accounts.
- Enforce ownership.
- Prevent owner ID mutation.
- Prevent vault ID mutation.
- Validate document fields.
- Validate field types.
- Validate allowed enums.
- Limit arrays.
- Limit ciphertext sizes.
- Prevent cross-user access.
- Deny unknown document shapes where practical.

Use reusable rules functions.

Provide emulator tests for:

- Unauthenticated access.
- Unverified accounts.
- Owner access.
- Cross-user reads.
- Cross-user writes.
- Owner reassignment.
- Invalid fields.
- Invalid enums.
- Oversized ciphertext.
- Invalid batch writes.

Do not deploy permissive rules.

---

# 30. Activity logging

Record non-sensitive events:

- Login.
- Logout.
- MFA enrollment.
- MFA removal.
- Vault creation.
- Project creation.
- Environment creation.
- Variable creation.
- Variable update.
- Variable deletion.
- Import.
- Export request.
- Bulk update.
- Device authorization.
- Device session creation.
- Device session revocation.
- Revision restoration.

Never log:

- Plaintext variable values.
- Vault passphrases.
- Recovery keys.
- TOTP secrets.
- Encryption keys.
- Complete import content.
- Complete export content.
- Authentication tokens.

Use structured logging with request IDs.

---

# 31. Web application routes

Create routes similar to:

```text
/
├── login
├── register
├── verify-email
├── forgot-password
├── mfa-challenge
├── device
│   └── authorize
└── app
    ├── dashboard
    ├── projects
    │   └── [projectId]
    │       └── environments
    │           └── [environmentId]
    │               ├── variables
    │               ├── compare
    │               └── history
    ├── import
    ├── activity
    └── settings
        ├── profile
        ├── security
        ├── devices
        ├── vault
        └── appearance
```

Use route groups and layouts where appropriate.

---

# 32. Dashboard

Display:

- Number of projects.
- Number of environments.
- Number of variables.
- Recently updated environments.
- Recent non-sensitive activity.
- Email verification status.
- MFA status.
- Vault lock status.
- Active devices.
- Quick project creation.
- Quick import action.

Do not retrieve or decrypt every variable to render the dashboard.

---

# 33. Visual direction

Create a modern and restrained interface inspired by:

- Linear.
- Vercel.
- Raycast.
- Modern password managers.

Do not copy their branding or exact layouts.

Requirements:

- Light and dark mode.
- Neutral surfaces.
- Restrained accent color.
- Subtle borders.
- Minimal shadows.
- Monospace font for variable keys and values.
- Strong accessibility.
- Clear keyboard focus.
- Responsive behavior.
- Desktop-optimized variable editor.
- Skeleton loading states.
- Empty states.
- Confirmation dialogs.
- Command palette using `Cmd/Ctrl + K`.
- Smooth but restrained transitions.
- Production warning indicators.
- Vault lock indicator.
- Unsaved-change indicators.
- Copy confirmations.

Avoid:

- Excessive gradients.
- Excessive glass effects.
- Oversized cards.
- Decorative motion.
- Hidden security states.

---

# 34. Application environment configuration

Support:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

NEXT_PUBLIC_APP_NAME=Keep
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_APP_CHECK=false

SESSION_COOKIE_NAME=keep_session
SESSION_MAX_AGE_SECONDS=432000

DEVICE_AUTHORIZATION_TTL_SECONDS=600
DEVICE_SESSION_MAX_AGE_SECONDS=2592000

VAULT_PBKDF2_ITERATIONS=
```

Create typed environment validation using Zod.

Separate public and server-only environment modules.

Never import server-only variables into client components.

Correctly normalize multiline Firebase private keys.

Provide `.env.example`.

Ignore all credential-containing `.env` files in Git.

---

# 35. Error handling

Create typed errors for:

- Unauthenticated.
- Forbidden.
- Email not verified.
- MFA required.
- Invalid MFA code.
- Recent authentication required.
- Vault locked.
- Incorrect vault passphrase.
- Invalid recovery key.
- Corrupt ciphertext.
- Unsupported encryption version.
- Invalid request.
- Duplicate variable.
- Environment version conflict.
- Idempotency conflict.
- Import parse error.
- Partial bulk-operation failure.
- Device authorization expired.
- Device authorization already used.
- Device session revoked.
- Firestore unavailable.

Map domain and application errors consistently to HTTP status codes.

Do not expose:

- Stack traces.
- Credentials.
- Internal Firestore paths.
- Ciphertext internals.
- Account-existence information.

---

# 36. Testing requirements

## Unit tests

Test:

- Dotenv parsing.
- Dotenv serialization.
- JSON import.
- Shell export parsing.
- Variable-key validation.
- Conflict detection.
- Bulk transformations.
- Environment comparison.
- Encryption and decryption.
- Wrong-key failure.
- IV uniqueness.
- Vault-key wrapping.
- Recovery-key wrapping.
- Browser and Node crypto compatibility.
- API schemas.
- API client.
- Environment version conflicts.
- Idempotency behavior.
- Device authorization expiry.
- Device authorization single use.

## Integration tests

Test:

- Route Handlers.
- Application services.
- Firestore repositories.
- Authentication middleware.
- Authorization.
- Versioned updates.
- Device authorization exchange.
- Session revocation.

## Firestore Rules tests

Test all ownership, verification and validation rules with the Emulator Suite.

## End-to-end tests

Test:

- Registration.
- Email-verification gating.
- Login.
- MFA enrollment.
- MFA challenge.
- Vault creation.
- Vault lock and unlock.
- Project creation.
- Environment creation.
- Variable creation.
- Bulk update.
- Import preview.
- Import commit.
- Comparison.
- Export.
- Revision restoration.
- Device approval page.
- Device session revocation.

Never use production Firebase resources in automated tests.

---

# 37. Documentation

Provide:

- `README.md`.
- Local setup instructions.
- Firebase project setup.
- Identity Platform setup.
- TOTP MFA setup.
- Firebase Emulator setup.
- Firestore rules deployment.
- Firestore indexes deployment.
- Environment-variable reference.
- Build and deployment instructions.
- API documentation.
- Typed client usage.
- Device-authorization design.
- Encryption protocol.
- Threat model.
- Data model.
- Architecture decisions.
- Future VS Code extension integration guide.

Create at least these documents:

```text
docs/architecture.md
docs/encryption.md
docs/threat-model.md
docs/api.md
docs/device-authorization.md
docs/vscode-integration.md
docs/firestore-model.md
docs/security-checklist.md
```

---

# 38. Development scripts

Provide scripts similar to:

```json
{
  "dev": "turbo dev",
  "build": "turbo build",
  "lint": "turbo lint",
  "typecheck": "turbo typecheck",
  "test": "turbo test",
  "test:e2e": "playwright test",
  "emulators": "firebase emulators:start",
  "format": "prettier --write .",
  "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
}
```

Keep the project runnable after every implementation phase.

---

# 39. Delivery phases

## Phase 1 — Foundation

- Create the monorepo.
- Configure pnpm workspace.
- Configure Turborepo.
- Create the Next.js application.
- Create shared packages.
- Configure TypeScript.
- Configure linting and formatting.
- Configure UI foundation.
- Configure typed environment variables.
- Configure Firebase Emulator Suite.
- Add initial CI checks.

## Phase 2 — Domain and API foundation

- Define domain entities.
- Define application-service interfaces.
- Define repository interfaces.
- Define Zod API contracts.
- Implement typed API response helpers.
- Implement structured errors.
- Create `/api/v1`.
- Build the shared API client.

## Phase 3 — Authentication

- Registration.
- Email verification.
- Login.
- Logout.
- Password reset.
- Secure server sessions.
- Route protection.
- Reauthentication.
- TOTP enrollment.
- MFA challenge.
- Security settings.

## Phase 4 — Encrypted vault

- Vault creation.
- Passphrase derivation.
- Vault-key generation.
- Key wrapping.
- Recovery key.
- Browser crypto adapter.
- Node crypto adapter.
- Compatibility tests.
- Vault locking.
- Automatic locking.

## Phase 5 — Core data management

- Projects.
- Environments.
- Variables.
- Server-side repositories.
- Firestore rules.
- Firestore indexes.
- Variable editor.
- CRUD operations.
- Revision creation.

## Phase 6 — Productivity

- [x] Dotenv parser.
- [x] Import preview.
- [x] Import execution.
- [x] Export.
- [x] Bulk actions.
- [x] Search.
- [x] Filters.
- [x] Keyboard shortcuts.
- [x] Command palette.

Phase 6 is complete. Variable workspaces support visibility, tag and recent
modification filters; keyboard-first creation, search and export workflows; an
environment command menu; and an application-wide command palette.

## Phase 7 — Synchronization safety

- [x] Environment versioning.
- [x] Expected-version writes.
- [x] Atomic Redis compare-and-set mutation checks.
- [x] HTTP 409 conflicts with expected and current versions.
- [x] Conflict-resolution and automatic refresh UI.
- [x] Idempotency keys for synchronization, import and bulk operations.
- [x] Safe operation records without plaintext values.

## Phase 8 — Device architecture and VS Code extension

Phase 8 begins immediately after synchronization safety. Revision history and
activity are intentionally postponed so the existing API-first architecture can
serve its first external client.

### Stage A — Device authorization

- [x] Device authorization model and short-lived browser approval codes.
- [x] Scoped device-session model.
- [x] Device approval page.
- [x] Device authorization and token-exchange endpoints.
- [x] Device list and revocation controls in Settings.

### Stage B — VS Code extension foundation

- [x] Create `apps/vscode-extension`.
- [x] Authenticate through browser-based device authorization.
- [x] Store only revocable device credentials in VS Code secret storage.
- [x] Use the shared API client and `/api/v1`; never connect directly to Redis
      or Firebase.
- [x] Select projects and environments.
- [x] Package and publish the initial Marketplace pre-release.
- [x] Pull remote environments into local dotenv files. _(delivered in Phase 11, Stage C.)_
- [x] Push updates with expected-version and idempotency protection. _(delivered in Phase 11, Stage D.)_
- [x] Present refresh, overwrite and merge choices for HTTP 409 conflicts. _(delivered in Phase 11, Stage D.)_
- [x] Document extension security, session scopes and revocation.

### Dashboard reconciliation

- [x] Replace hard-coded workspace counters with an atomically maintained,
      non-sensitive Redis overview.
- [x] Add a project-to-environment dashboard navigator with direct variable
      workspace links.
- [x] Show the actual authorized external-device count.

## Phase 9 — Comparison and history

- Environment comparison.
- Difference actions.
- Revision history.
- Revision decryption.
- Revision restoration.
- Activity screen.

## Next milestone — Productivity, synchronization and usable history

This milestone combines the first production-ready portions of Phases 6, 7 and 8.
Track implementation against the following checklist and keep the application runnable
after every stage.

### Stage A — Shared import foundation

- [x] Build the shared dotenv parser.
- [x] Support comments, empty values, quoting and escaped characters.
- [x] Support safely parseable multiline values.
- [x] Support shell-style `export KEY=value` entries.
- [x] Preserve variable references without evaluating them.
- [x] Detect duplicate keys and report their source locations.
- [x] Reject invalid keys and warn about suspicious shell content without executing it.
- [x] Add comprehensive parser and serializer tests.

### Stage B — Secure import workflow

- [x] Accept uploaded dotenv files and pasted dotenv content.
- [x] Show an import preview classifying variables as new, updated, unchanged,
      invalid or conflicting.
- [x] Support overwrite, skip-existing, import-new-only and individual conflict review.
- [x] Encrypt every imported plaintext value locally before sending mutations to the API.
- [x] Ensure plaintext import content is never persisted or logged.
- [x] Commit imports with expected environment versions.
- [x] Protect import retries with idempotency keys and operation records.
- [x] Chunk large imports and report progress safely.

### Stage C — Local export workflow

- [x] Export decrypted values locally as `.env`.
- [x] Export decrypted values locally as JSON.
- [x] Export decrypted values locally as shell `export` statements.
- [x] Export decrypted values locally as a Docker Compose environment snippet.
- [x] Export decrypted values locally as Kubernetes Secret YAML.
- [x] Explain that Kubernetes base64 values are encoded rather than encrypted.
- [x] Support copying and downloading exports without sending plaintext to the server.

### Stage D — Variable selection and bulk operations

- [x] Add variable row selection and select-all behavior.
- [x] Bulk delete selected variables.
- [x] Bulk change visibility.
- [x] Bulk add and remove tags.
- [x] Bulk add and remove key prefixes.
- [x] Bulk convert variable keys to uppercase.
- [x] Detect key collisions before applying transformations.
- [x] Apply bulk mutations with expected-version and idempotency protection.

### Stage E — Revision history and restoration

- [ ] Add revision-history API contracts, client methods and route handlers.
- [ ] Add paginated environment and variable revision lists.
- [ ] Keep revision-list metadata non-sensitive.
- [ ] Decrypt only one explicitly selected revision value at a time.
- [ ] Restore a selected revision as a new encrypted revision.
- [ ] Require expected-version checking when restoring.
- [ ] Present version conflicts through the shared notification and resolution UI.

### Stage F — Activity records

- [ ] Create non-sensitive activity records for imports, exports, bulk changes,
      variable mutations and revision restoration.
- [ ] Never include plaintext values, ciphertext, wrapped keys or sensitive metadata
      in activity records.
- [ ] Add activity API contracts, client methods and route handlers.
- [ ] Add a paginated activity page with useful filters.

### Milestone acceptance criteria

- [x] Import parsing, preview and execution contract tests pass.
- [x] Imported plaintext is encrypted before any API request.
- [x] All export formats are generated locally.
- [x] Retried imports and bulk mutations do not duplicate changes.
- [x] Stale import and bulk writes return HTTP 409.
- [ ] Revision history does not decrypt values while listing.
- [ ] Activity records contain no secret material.
- [ ] Lint, typecheck, unit tests and production build pass.

## Phase 10 — Hardening

- Rules tests.
- Integration tests.
- End-to-end tests.
- Accessibility review.
- Threat-model review.
- Logging review.
- Secret-leak review.
- Performance review.
- Production build verification.
- Deployment documentation.

Do not skip foundational phases to build polished UI first.

---

# 40. Acceptance criteria

The project is complete only when:

- It builds without TypeScript errors.
- Linting passes.
- Unit tests pass.
- Integration tests pass.
- Firestore rules tests pass.
- Core Playwright tests pass.
- The website uses the typed API client.
- Core domain operations do not directly access Firestore from React components.
- API contracts are shared.
- APIs are versioned.
- No plaintext secret is sent to the server.
- No plaintext secret is stored in Firestore.
- No plaintext secret is persisted in browser storage.
- Browser and Node encryption implementations are compatible.
- Email verification is enforced.
- TOTP MFA works.
- Secure web sessions are implemented.
- Vault lock clears active in-memory key material.
- Import and export work.
- Bulk updates work.
- Version conflicts return HTTP 409.
- Idempotent retries do not duplicate changes.
- Environment comparison works.
- Revision restoration works.
- Device authorization is designed and implemented securely.
- Device sessions can be reviewed and revoked.
- A future VS Code extension can consume the same API, API client, contracts and encryption protocol.
- Light and dark themes work.
- The interface is polished and accessible.
- Setup and deployment documentation are complete.

---

# 41. Initial agent response

Before writing substantial implementation code, provide:

1. Architecture summary.
2. Monorepo folder structure.
3. Domain boundaries.
4. API contract structure.
5. Firestore model.
6. Authentication and web-session flow.
7. TOTP MFA flow.
8. Encryption flow.
9. Browser and Node encryption compatibility approach.
10. Device-authorization flow.
11. Environment-versioning strategy.
12. Threat-model summary.
13. Implementation phases.

Then begin Phase 1 immediately.

Do not stop after producing the plan.

Do not leave critical features as mock buttons.

Do not store realistic example credentials.

When a Firebase feature requires manual console configuration, implement the application side and document the exact console steps.

---

# Phase 11 — VS Code Extension Maturity

The extension today authenticates through browser-based device authorization and
can list projects and environments, but it never touches `@keephq/crypto`. It
can read metadata only — it cannot decrypt or write a single variable value. This
phase turns it into a tool a developer actually installs: **pull an environment
into `.env`, edit safely, and push back — without plaintext ever leaving the
machine, and without clobbering another client's changes.**

All primitives already exist. `vault.get()` returns the wrapped vault-key
material and derivation metadata; `@keephq/crypto` provides
`unlockVaultWithPassphrase`, `unlockVaultWithRecoveryKey`,
`encryptVariableValue` and `decryptVariableValue`; `@keephq/dotenv` provides the
shared parser and serializer; and Node's global `crypto.subtle` lets the existing
browser provider run unchanged in the extension host. This phase is wiring and
UX, not new cryptography.

## Design decisions

- **Unlock once per device.** The user is not asked for their passphrase on every
  session. On first unlock (passphrase or recovery key) the extension creates a
  **device-wrapped copy** of the vault key. The random device secret is kept in
  VS Code `SecretStorage`; the device-wrapped key material is stored **server-side,
  bound to the current device session**, so revoking the device from the web
  invalidates the wrapping record and disables silent unlock. Neither the
  passphrase, the recovery key, nor the unwrapped vault key is ever persisted.
- **Unwrapped vault key lives in memory only** and is cleared on lock, sign-out,
  auto-lock expiry and window close — matching Plan §17.
- **Reuse shared packages.** `@keephq/crypto` and `@keephq/dotenv` only; the
  extension continues to use `/api/v1` through `@keephq/api-client` and never
  connects directly to Redis or Firebase.

### Stage A — Local decryption foundation

- [x] Add `@keephq/crypto` and `@keephq/dotenv` as extension dependencies.
- [x] Expose a `getNodeCryptoProvider()` in `packages/crypto` (thin alias over the
      existing provider using the Node global `crypto`); assert `subtle` is present.
- [x] Add an in-memory vault-key holder with an auto-lock timer sourced from vault
      settings; clear it on lock, sign-out, expiry and `deactivate`.
- [x] `Keep: Unlock vault` — prompt for passphrase or recovery key via a masked
      input, fetch `vault.get()`, derive and unwrap the key, hold it in memory.
- [x] `Keep: Lock vault`.

### Stage B — Device-wrapped key (no repeated passphrase)

- [x] Add a `"device"` purpose to the key-wrapping additional-data union in
      `packages/crypto`.
- [x] On first successful unlock, generate a random 32-byte device secret, wrap the
      vault key with it, and store the secret in `SecretStorage`.
- [x] Add endpoints to store and fetch the device-wrapped key material bound to the
      current device session (`PUT`/`GET`/`DELETE /api/v1/device/vault-key`); persist
      only ciphertext and IV — never the device secret or any plaintext.
- [x] On later sessions, fetch the wrapped material and combine it with the local
      device secret to unwrap silently — no passphrase prompt.
- [x] Revoking the device session from the web invalidates the wrapping record; the
      extension falls back to passphrase unlock.

### Stage C — Pull

- [x] `Keep: Pull environment` — decrypt every variable locally and serialize with
      `@keephq/dotenv` into a workspace `.env` file.
- [x] Warn and show a diff before overwriting an existing `.env`.
- [x] Remember the target file per environment.

### Stage D — Push with concurrency safety

- [x] `Keep: Push environment` — parse the local `.env` with `@keephq/dotenv` and
      show a preview classifying variables as new, updated, unchanged or invalid.
- [x] Encrypt values locally, then commit via the import endpoint with an expected
      environment version and a per-chunk idempotency key.
- [x] On HTTP 409, present Overwrite / Compare-&-merge choices; re-plan against the
      latest version so retries never push stale data.

### Stage E — Native UX

- [x] Status-bar item showing lock state and the selected `project / environment`,
      clickable to open Keep quick actions.
- [x] Activity Bar tree view: projects → environments → variables (masked keys), with
      pull and push from context menus. _(In-tree temporary reveal deferred — reveal
      is available by pulling into `.env`.)_
- [x] `.env` compare against remote (on-demand diff during pull and push conflicts).
      _(A standing CodeLens drift indicator is deferred.)_
- [x] Per-workspace-folder environment binding for multi-root workspaces.

### Stage F — Hardening and Marketplace

- [x] Unit tests for push preview/conflict classification and device-key wrapping.
- [ ] Integration test driving pull/push against a mock `KeepClient`. _(Deferred —
      requires a VS Code test host harness.)_
- [x] Secret-leak review: no plaintext values, passphrases, recovery keys, device
      secrets or vault keys in logs, notifications, telemetry or workspace state.
- [x] First-run `walkthrough` contribution and updated `README`/`CHANGELOG`.
- [x] Scope `activationEvents` (`onView:keep.explorer`); handle expired and revoked
      sessions gracefully.

### Acceptance criteria

- [x] The unwrapped vault key exists only in memory; nothing persistent holds the
      passphrase, recovery key or unwrapped key.
- [x] The passphrase is entered at most once per device until the device is revoked.
- [x] Pull writes a correct decrypted `.env`; push round-trips without any plaintext
      leaving the machine.
- [x] Stale pushes return HTTP 409 and surface Overwrite / Compare-&-merge.
- [x] Revoking the device from the web disables silent unlock.
- [x] Lint, typecheck, unit tests and the extension build pass.

---

# Part II — Keep Clipboard

Cross-device clipboard sync built as a bounded module **inside Keep**, reusing
the existing BFF, identity, Redis, crypto, device model, and design system. It
is _not_ a separate app, server, brand, or auth system.

## II-A. Repo reconciliation — overrides to the spec below

The full feature spec (§§1–29 below) was written by inspecting the product
_goals_, before the repository was examined. Now that the repo is known, the
following **overrides apply** — they take precedence wherever the spec below
guesses at structure. They also substantially shrink the work.

### 1. Device pairing is ~80% already built — reuse it, do not rebuild

The spec's §11 "Device Pairing" and its separate `devices` / `device-auth` /
`device-pairing` / `device-session` modules **duplicate an existing system**.
Keep already ships a browser-approved **device authorization** flow (see
`docs/device-authorization.md` and Part I §15–16, Phase 8, Phase 11):

- PKCE verifier + SHA-256 challenge, short-lived browser approval, user-visible
  scopes, single-use code exchange.
- Only a **SHA-256 token hash** is indexed in Redis; the raw token lives in VS
  Code `SecretStorage`.
- Scoped, revocable **device sessions** with immediate revocation from Settings.
- Redis keys already exist: `keep:v1:device-authorization:{id}`,
  `keep:v1:device-user-code:{code}`, `keep:v1:device-session:{id}`,
  `keep:v1:device-token:{tokenHash}`, `keep:v1:user:{userId}:device-sessions`.

**Override:** Do **not** create a parallel clipboard device/pairing module.
**Extend the existing device authorization** with new clipboard **scopes** and
reuse its pairing UI, token storage, and revocation. The spec's §7.2/§7.3 device
and credential models are satisfied by the existing `DeviceSession` model
(Part I §16) plus these scopes.

New scopes to add to the existing scope union:

```text
clipboard:read
clipboard:write
clipboard:receive        # may receive pushed items
clipboard:auto-receive   # opt-in; NOT granted automatically on pairing
```

### 2. Redis — reuse the existing client and key convention

Use `getKeepRedis()` and `keepRedisKey(...)` (`packages/redis`). All clipboard
keys live under the **retained** prefix as **`envault:v1:clipboard:…`** (see
0.6 — the prefix value stays `envault:v1` for data continuity). Do not introduce
a new client or prefix. Redis is primary storage (Part 0.5); the spec below
already assumes Redis — this is aligned.

### 3. Encryption — reuse `@keephq/crypto`

The spec's §18 (AES-256-GCM envelope, versioned keys, key wrapping) is already
embodied by `@keephq/crypto` (`browser` / `node` / `key-wrapping` / `protocol`
adapters) and the vault key hierarchy (Part I §9–11, §17; Phase 11 device-wrapped
keys). Stage-1 (server-protected) ships now; Stage-2 client-side envelope
encryption reuses the existing key-wrapping and the device-wrapped-key mechanism
rather than inventing new crypto. Add a `"clipboard"` purpose to the
key-wrapping additional-data union when Stage 2 lands (mirrors the `"device"`
purpose added in Part I Phase 11 Stage B).

### 4. Shared contracts & module boundaries — conform to the monorepo

Ignore the spec's `src/modules/**` layout (§6). Follow the existing structure:

- Types + Zod schemas → `packages/domain` and `packages/api-contract`
  (alongside variables/devices), consumed by web, VS Code, and future clients.
- Client methods → `packages/api-client` (`KeepClient`), e.g.
  `client.clipboard.*`.
- Server logic → application services + Route Handlers under `/api/v1`
  (Part I §3, §5), **not** ad-hoc `controller`/`repository` files. Clipboard
  routes are versioned as `/api/v1/clipboard/*` to match existing conventions
  (the spec's unversioned `/api/clipboard/*` is superseded).
- Web UI → `apps/website` dashboard route (see §16 below), behind the flag.

### 5. VS Code — extend the existing mature extension

Part I Phase 8 + Phase 11 already delivered auth, `KeepClient`, `SecretStorage`,
status bar, tree view, and secure device-wrapped unlock. Add the clipboard
commands (§12 below) into `apps/keep-vscode`; reuse everything. There is a real
product synergy: Keep Secrets already "copies a variable value to the clipboard"
(Part I §22) — with Keep Clipboard that becomes _"push this secret to another
device's clipboard,"_ end-to-end encrypted.

### 6. Feature flag & scope for _now_

Everything ships behind `KEEP_CLIPBOARD_ENABLED`. **Do now: Phase 1 + Phase 2**
of §25 below (core module + web dashboard + VS Code send/receive, request/
response + manual receive). **Defer:** real-time Streams+SSE (Phase 3), desktop
(Phase 4), Android (Phase 5), iOS (Phase 6), client-side encryption (Phase 7).
These map onto the unified roadmap as Part I's continuation (see Part III).

### 7. Config & routes naming

Clipboard config uses the `KEEP_CLIPBOARD_*` prefix (§21 below). Routes are
`/api/v1/clipboard/*`, `/api/v1/device-sessions/*` (existing, extended with
clipboard scopes) — not a new top-level `/api/clipboard`.

---

## II-B. Keep Clipboard feature specification

> The following is the original clipboard spec, rebranded (Envault → Keep) and
> kept for completeness. Where it conflicts with II-A above, **II-A wins**
> (device pairing, module layout, versioned routes, crypto reuse).

---

# Keep Cross-Device Clipboard Sync — Implementation Handoff

## 1. Objective

Extend the existing Keep application with a secure cross-device clipboard synchronization capability.

Keep already has:

- A mature Next.js application.
- A Backend-for-Frontend architecture.
- Redis as persistent application storage.
- Firebase Authentication.
- A mature VS Code extension.
- Existing user, session, security, and application conventions.

Do not create a separate application or independent sync server.

The existing Keep BFF must become the authoritative clipboard synchronization server. The feature must be implemented as a clean bounded module inside Keep and must reuse the existing architecture, authentication, Redis clients, logging conventions, validation, error handling, configuration, and UI design system.

The feature should support:

- Keep web application.
- Existing Keep VS Code extension.
- macOS desktop companion.
- Windows desktop companion.
- Samsung and general Android companion.
- iPhone and iPad companion at a later stage.
- Tablet-friendly Keep clipboard dashboard.

The first release should focus on reliable synchronization of text, URLs, JSON, commands, and code snippets.

Images and files should be designed for, but do not need to be enabled in the first milestone.

---

# 2. Product Name

Use the feature name:

**Keep Clipboard**

Use these internal module names:

```text
clipboard
clipboard-sync
device-pairing
device-session
```

Do not create a separate ClipBridge product, brand, repository, authentication system, or backend.

---

# 3. Core Product Experience

A user should be able to:

1. Copy text on a Mac.
2. Have the Keep desktop companion detect it.
3. Send it securely to the Keep BFF.
4. See it immediately in Keep Clipboard.
5. Retrieve it through:

   - Windows companion.
   - VS Code extension.
   - Samsung tablet.
   - Android phone.
   - Future iPhone or iPad app.

6. Copy it into the destination device clipboard.
7. Search, pin, expire, consume, or delete the item.

Example:

```text
Copy on Mac
    ↓
Keep desktop companion
    ↓
Keep BFF
    ↓
Redis history and synchronization stream
    ↓
Windows / VS Code / Samsung / iPhone / web dashboard
```

Manual receive should be the default.

Automatic receive must be opt-in per device and should initially be supported only by desktop companions.

---

# 4. Important Platform Constraints

Implement platform-specific behavior rather than pretending every platform permits the same clipboard access.

## 4.1 macOS

A desktop companion can monitor the macOS general pasteboard while it is running.

Support:

- Automatic detection of clipboard changes.
- Automatic sending, when enabled.
- Manual or automatic receiving.
- Menu bar history.
- Global shortcut.
- Start at login.
- Pause synchronization.
- Ignore-list and sensitivity rules.
- Secure device credential storage.

The companion must avoid sending clipboard events back to the server after it applies a remote clipboard item locally.

## 4.2 Windows

A desktop companion can monitor the Windows clipboard while it is running.

Support:

- Automatic detection.
- Automatic sending.
- Manual or optional automatic receiving.
- System tray interface.
- Global shortcut.
- Start at login.
- Pause synchronization.
- Secure device credential storage.
- Clipboard loop prevention.

## 4.3 Android and Samsung tablets

Do not design Android around invisible background clipboard monitoring.

Modern Android restricts clipboard reads when the application is not currently focused, except for special cases such as the active keyboard.

The Android experience should initially use:

- Keep Clipboard app screen.
- Tap an Keep item to copy it to Android clipboard.
- Paste current Android clipboard into Keep after opening the app.
- Android Sharesheet integration:

  - Select text in another application.
  - Tap Share.
  - Select Keep.
  - Send to one or more paired devices.

- “Send to Keep” action.
- Optional Quick Settings tile.
- Optional home-screen widget showing recent items.
- Foreground notification only when doing a visible transfer.
- Deep links from the Keep website.
- Biometric confirmation for sensitive items.

Samsung-specific enhancements may be added where practical, but core behavior must use standard Android APIs and must not depend exclusively on Samsung services.

Do not require Keep to become the default Android keyboard in the MVP.

A custom keyboard integration may be investigated later, but it is not part of the initial scope because of security, privacy, user trust, and implementation complexity.

## 4.4 iPhone and iPad

Do not design iOS around continuous clipboard monitoring.

The future iOS/iPadOS companion should use:

- Keep app clipboard history.
- Tap to copy an item to the system pasteboard.
- Explicit “Send Clipboard” action.
- Share Extension:

  - Select text, URL, or supported content.
  - Tap Share.
  - Select Keep.

- Shortcuts/App Intents integration.
- Optional widget for recent non-sensitive items.
- Biometric confirmation.
- Universal Links for pairing.
- Explicit user interaction before reading clipboard content copied by another application.

Do not promise automatic, always-running cross-app clipboard monitoring on iOS.

---

# 5. Recommended Architecture

```text
┌──────────────────────────────┐
│ Keep Web / Tablet PWA     │
└───────────────┬──────────────┘
                │
┌───────────────▼──────────────┐
│ Existing Keep Next.js BFF │
│                              │
│ Clipboard module             │
│ Device authentication        │
│ Pairing flow                 │
│ Sync delivery                │
│ Authorization policies       │
└───────────────┬──────────────┘
                │
        ┌───────▼────────┐
        │ Existing Redis │
        │                │
        │ History        │
        │ Streams        │
        │ Presence       │
        │ Pairing        │
        │ Dedupe         │
        └───────┬────────┘
                │
     ┌──────────┼────────────┐
     │          │            │
┌────▼────┐ ┌───▼────┐ ┌────▼─────────┐
│ VS Code │ │Desktop │ │Mobile clients│
│Extension│ │Agents  │ │Android / iOS │
└─────────┘ └────────┘ └──────────────┘
```

Firebase Authentication remains the user identity provider.

The BFF must remain the only trusted authority that:

- Resolves the authenticated user.
- Authorizes device access.
- Accepts clipboard content.
- Reads clipboard history.
- Issues device credentials.
- Revokes devices.
- Enforces quotas and retention.
- Publishes synchronization events.

Clients must never connect directly to Redis.

---

# 6. Module Boundaries

Adapt the paths below to the actual Keep repository structure and conventions.

Suggested logical structure:

```text
src/
├── modules/
│   └── clipboard/
│       ├── clipboard.types.ts
│       ├── clipboard.schemas.ts
│       ├── clipboard.service.ts
│       ├── clipboard.repository.ts
│       ├── clipboard.controller.ts
│       ├── clipboard.policy.ts
│       ├── clipboard.crypto.ts
│       ├── clipboard.preview.ts
│       ├── clipboard.sensitivity.ts
│       ├── clipboard.events.ts
│       └── clipboard.errors.ts
│
├── modules/
│   └── devices/
│       ├── device.types.ts
│       ├── device.service.ts
│       ├── device.repository.ts
│       ├── device-auth.service.ts
│       ├── device-pairing.service.ts
│       └── device.schemas.ts
│
└── app/
    ├── api/
    │   ├── clipboard/
    │   └── devices/
    └── dashboard/
        └── clipboard/
```

If Keep already has service, route, repository, or domain conventions, conform to those conventions instead of forcing this exact layout.

---

# 7. Data Model

## 7.1 Clipboard item

Create a shared schema usable by:

- BFF.
- Web UI.
- VS Code extension.
- Desktop companion.
- Future mobile clients.

```ts
export type ClipboardContentType =
  "text" | "url" | "code" | "json" | "command" | "image" | "file";

export type ClipboardOriginClient =
  "web" | "vscode" | "macos" | "windows" | "android" | "ios";

export type ClipboardSensitivity = "normal" | "sensitive" | "secret";

export type ClipboardPersistenceMode = "once" | "temporary" | "pinned";

export interface ClipboardItem {
  id: string;
  userId: string;

  originDeviceId: string;
  originDeviceName: string;
  originClient: ClipboardOriginClient;

  contentType: ClipboardContentType;

  encryptedPayload: string;
  encryptionVersion: number;

  safePreview: string | null;
  contentHash: string;
  byteLength: number;

  language?: string;
  mimeType?: string;

  sensitivity: ClipboardSensitivity;
  persistenceMode: ClipboardPersistenceMode;

  consumedAt?: string;
  pinnedAt?: string;

  createdAt: string;
  expiresAt?: string;
}
```

The API must derive `userId` from the authenticated web session or authenticated device credential.

Never accept an authoritative `userId` from request bodies.

## 7.2 Device

```ts
export type KeepDeviceType =
  "vscode" | "macos" | "windows" | "android" | "ios" | "web";

export interface KeepDevice {
  id: string;
  userId: string;

  name: string;
  type: KeepDeviceType;

  publicKey?: string;

  autoSendEnabled: boolean;
  autoReceiveEnabled: boolean;

  createdAt: string;
  approvedAt: string;
  lastSeenAt?: string;
  revokedAt?: string;

  appVersion?: string;
  platformVersion?: string;
}
```

## 7.3 Device credential

```ts
export interface DeviceCredentialRecord {
  deviceId: string;
  userId: string;

  tokenHash: string;
  tokenVersion: number;

  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}
```

Never store raw device tokens in Redis.

Store a secure hash of each device credential.

---

# 8. Redis Storage Design

Reuse the existing Redis client and namespace configuration.

Use the existing Keep environment namespace as the prefix.

Example logical keys:

```text
{keepPrefix}:clipboard:user:{userId}:items
{keepPrefix}:clipboard:user:{userId}:pinned
{keepPrefix}:clipboard:item:{itemId}
{keepPrefix}:clipboard:user:{userId}:stream

{keepPrefix}:devices:user:{userId}
{keepPrefix}:device:{deviceId}
{keepPrefix}:device-token:{deviceId}:{tokenVersion}

{keepPrefix}:clipboard:pairing:{pairingId}
{keepPrefix}:clipboard:pairing-code:{code}

{keepPrefix}:clipboard:presence:{deviceId}
{keepPrefix}:clipboard:dedupe:{userId}:{contentHash}
{keepPrefix}:clipboard:delivery:{deviceId}:{itemId}
```

Recommended Redis structures:

```text
Clipboard item                     Hash or Redis JSON
Clipboard history                  Sorted set
Pinned items                       Sorted set
Synchronization event log          Redis Stream
Devices per user                   Set
Device record                      Hash or Redis JSON
Presence                           String with TTL
Pairing session                    Hash with TTL
Content deduplication               String with TTL
Delivery acknowledgement           Hash or short-lived string
```

Recommended defaults:

```text
Temporary clipboard TTL:            7 days
One-time clipboard TTL:             10 minutes
Pairing code TTL:                   5 minutes
Presence TTL:                       60 seconds
Deduplication TTL:                  30 seconds
Maximum history items:              500
Maximum text payload:               256 KiB
Maximum pinned text items:          100
```

Make these configurable.

Pinned items should not expire automatically unless the user explicitly configures an expiration date.

---

# 9. Synchronization Protocol

## 9.1 Create item

Client sends:

```json
{
  "originDeviceId": "device-id",
  "originClient": "vscode",
  "contentType": "code",
  "encryptedPayload": "base64-or-envelope-value",
  "encryptionVersion": 1,
  "safePreview": "kubectl get pods…",
  "contentHash": "sha256:...",
  "byteLength": 118,
  "language": "shellscript",
  "sensitivity": "normal",
  "persistenceMode": "temporary"
}
```

Server must:

1. Authenticate the caller.
2. Verify the device belongs to the authenticated user.
3. Validate payload and limits.
4. Verify origin device has not been revoked.
5. Enforce rate limits.
6. Check duplicate content hash window.
7. Generate the authoritative item ID.
8. Generate authoritative timestamps.
9. Store the item.
10. Add it to user history.
11. Append a creation event to the user Redis Stream.
12. Publish it to connected clients.
13. Trim history when necessary.
14. Return sanitized metadata.

## 9.2 Event envelope

```ts
export interface ClipboardSyncEvent {
  eventId: string;

  type:
    | "clipboard.created"
    | "clipboard.updated"
    | "clipboard.deleted"
    | "clipboard.consumed"
    | "clipboard.pinned"
    | "clipboard.unpinned"
    | "device.revoked";

  userId: string;
  itemId?: string;
  originDeviceId?: string;

  createdAt: string;
}
```

## 9.3 Real-time transport

Use whichever real-time mechanism best fits the existing Keep deployment.

Preferred order:

1. WebSocket, if the existing hosting model supports durable WebSocket connections.
2. Server-Sent Events for browser and desktop notifications.
3. Long polling as fallback.

Redis Streams should remain the durable internal event mechanism regardless of the client delivery transport.

Do not make Redis Pub/Sub the only delivery mechanism because disconnected clients would miss events.

Use stream IDs or cursors so reconnecting clients can request events after their last acknowledged cursor.

Example connection state:

```json
{
  "deviceId": "device-id",
  "lastEventCursor": "1784312324000-0"
}
```

---

# 10. API Design

Adapt all routes to the existing Keep routing and response conventions.

## Clipboard items

```text
POST   /api/clipboard/items
GET    /api/clipboard/items
GET    /api/clipboard/items/:itemId
DELETE /api/clipboard/items/:itemId

POST   /api/clipboard/items/:itemId/pin
POST   /api/clipboard/items/:itemId/unpin
POST   /api/clipboard/items/:itemId/consume
POST   /api/clipboard/items/:itemId/copy-event
```

Suggested list query parameters:

```text
cursor
limit
deviceId
contentType
sensitivity
pinned
search
before
after
```

## Synchronization

```text
GET    /api/clipboard/events
GET    /api/clipboard/events/stream
POST   /api/clipboard/events/ack
```

## Devices

```text
GET    /api/devices
GET    /api/devices/:deviceId
PATCH  /api/devices/:deviceId
DELETE /api/devices/:deviceId

POST   /api/devices/:deviceId/revoke
POST   /api/devices/:deviceId/rename
POST   /api/devices/:deviceId/rotate-token
```

## Pairing

```text
POST   /api/device-pairing/start
GET    /api/device-pairing/:pairingId
POST   /api/device-pairing/:pairingId/approve
POST   /api/device-pairing/:pairingId/reject
POST   /api/device-pairing/:pairingId/exchange
```

Apply:

- Authentication.
- Authorization.
- CSRF protection where relevant.
- Schema validation.
- Rate limiting.
- Consistent error responses.
- Request correlation IDs.
- Safe structured logging.

---

# 11. Device Pairing Flow

Do not ask desktop or extension users to paste Firebase credentials into a client.

Use browser-based pairing.

## Flow

1. Client generates or requests a pairing session.
2. BFF returns:

   - Pairing ID.
   - Short pairing code.
   - Pairing URL.
   - Expiration time.

3. Client displays:

   - Code.
   - QR code where applicable.
   - “Open Keep” button.

4. User signs into Keep through the existing Firebase and BFF flow.
5. User sees:

   - Device name.
   - Device type.
   - Requested permissions.
   - Approximate platform information.

6. User approves or rejects.
7. Client polls or listens for approval.
8. Client exchanges the approved pairing session for:

   - Device ID.
   - One-time raw device token.
   - Sync configuration.

9. Server stores only the token hash.
10. Client stores the raw token in secure local storage.
11. Pairing session is invalidated immediately after successful exchange.

Requested permissions should be explicit:

```text
Send clipboard items
Receive clipboard items
Read clipboard history
Delete own items
Request automatic receive
```

Automatic receive permission should not automatically be granted just because a device was paired.

---

# 12. VS Code Extension Integration

Extend the existing mature Keep VS Code extension rather than creating another extension.

Reuse its:

- Authentication.
- API client.
- Configuration.
- Logging.
- Commands.
- Status bar.
- Webviews.
- Error handling.
- Secure token storage.
- Existing architecture.

Add commands:

```text
Keep: Send Selection to Clipboard
Keep: Send Current Editor Selection
Keep: Send Current Clipboard
Keep: Paste Latest Remote Clipboard
Keep: Open Clipboard History
Keep: Pin Selection
Keep: Clear Remote Clipboard
Keep: Pause Clipboard Sync
Keep: Resume Clipboard Sync
Keep: Pair This VS Code Device
Keep: Manage Clipboard Devices
```

## VS Code send-selection behavior

When a user sends selected code:

- Capture selected text.
- Detect language from the active editor.
- Mark content type as `code`.
- Include language metadata.
- Compute content hash.
- Apply sensitivity detection.
- Encrypt before submission when client encryption is enabled.
- Show a non-sensitive confirmation.

## Remote history picker

Use a VS Code Quick Pick interface.

Example:

```text
Keep Clipboard

> kubectl get pods -n argocd
  MacBook · Shell · 12 seconds ago

> REDIS_URL=••••••••
  Sensitive · Windows · 4 minutes ago

> https://github.com/...
  Android · URL · 10 minutes ago
```

Do not reveal secret previews.

On selection:

- Fetch and decrypt full content.
- Copy to VS Code clipboard or insert into the active editor.
- Support explicit actions:

  - Copy.
  - Insert.
  - Pin.
  - Delete.
  - Mark consumed.

## Secure storage

Store device tokens through the existing VS Code `ExtensionContext.secrets` mechanism.

Do not store device credentials in:

- Settings JSON.
- Workspace configuration.
- Extension globalState.
- Plain environment files.
- Logs.

## Remote extension behavior

Account for:

- Local VS Code.
- Remote SSH.
- Dev Containers.
- WSL.
- Codespaces.

The clipboard action should run in the UI extension host where required, not accidentally bind synchronization to the remote workspace host.

---

# 13. Desktop Companion

The desktop companion should be a separate Keep client but remain in the same repository or organization.

Choose either:

- Tauri, preferred for a small native desktop footprint.
- Electron, acceptable if it better matches the existing JavaScript expertise and delivery constraints.

Do not build separate macOS and Windows applications unless platform differences require isolated native modules.

## Features

- Tray or menu-bar interface.
- Clipboard change detection.
- Send changes to Keep.
- Receive remote notifications.
- Manual receive.
- Optional automatic receive.
- Global keyboard shortcut.
- Recent clipboard picker.
- Pause synchronization.
- Ignore current item.
- Start at login.
- Device rename.
- Device revoke.
- Sensitive-item warning.
- Connection status.
- Retry with exponential backoff.
- Offline queue with strict size and TTL limits.

## Default behavior

```text
Automatic send:       Off initially
Automatic receive:    Off
History notifications: On
Sensitive-item sync:  Ask
Start at login:       Optional
```

After onboarding, the user may enable automatic send.

## Loop prevention

Every local clipboard observation must compute a content hash.

Maintain:

```text
lastLocalHash
recentlyAppliedRemoteHashes
recentEventIds
```

When the companion writes a received item to the local clipboard:

1. Record its hash as remotely applied.
2. Write it locally.
3. Ignore that hash when the clipboard watcher detects it.
4. Expire the ignore marker after a short interval.

Never depend on comparing text alone indefinitely because the user may legitimately copy the same content again later.

---

# 14. Android and Samsung Companion

Implement Android only after the core web, BFF, Redis, VS Code, and desktop flows are stable.

Recommended technology:

- Native Kotlin with Jetpack Compose, or
- React Native if it aligns better with the existing team.

Prefer native Kotlin when implementing:

- Sharesheet.
- Quick Settings tile.
- Foreground services.
- Widgets.
- Clipboard APIs.
- Biometric authentication.
- Android Keystore.

## MVP Android features

- Firebase or Keep browser-based sign-in.
- Device registration.
- Clipboard history.
- Search.
- Tap to copy to Android clipboard.
- Paste and send current clipboard while the app is active.
- Share text and URLs into Keep.
- Send to all devices or selected device.
- Receive notifications.
- Pin and delete.
- Biometric confirmation for sensitive items.
- Device management.
- Tablet-optimized layout.

## Sharesheet

Register Keep as a receiver for:

```text
text/plain
text/uri-list
```

Later add:

```text
image/*
application/pdf
application/json
```

Sharesheet flow:

```text
User selects content
→ Share
→ Keep
→ Choose destination
→ Confirm
→ Upload
```

## Quick Settings tile

Optional phase:

```text
Send Clipboard to Keep
```

The tile should trigger an explicit user-visible action.

Do not use deceptive accessibility-service workarounds to gain broad clipboard access.

Do not require device administrator privileges.

Do not attempt to bypass Android clipboard privacy controls.

## Samsung-specific considerations

Test on the target Samsung tablet for:

- Battery optimization.
- Background network restrictions.
- One UI notification behavior.
- Split-screen mode.
- DeX mode.
- Large-screen responsive layout.
- Samsung Internet and Chrome PWA behavior.

Provide clear setup guidance if the user chooses to exempt Keep from battery optimization for reliable notifications.

The application must remain usable on ordinary Android devices.

---

# 15. iPhone and iPad Companion

Treat this as a later milestone.

Recommended implementation:

- SwiftUI.
- Share Extension.
- App Intents and Shortcuts.
- Keychain.
- CryptoKit.
- LocalAuthentication for Face ID and Touch ID.
- Push notifications where appropriate.

## MVP iOS features

- Sign in and device registration.
- Clipboard history.
- Search.
- Tap to copy into the system pasteboard.
- Explicit paste-and-send action.
- Share Extension.
- Pin and delete.
- Biometric confirmation.
- Device management.
- iPad layout.

## Share Extension flow

```text
User selects text or URL
→ Share
→ Keep
→ Choose destination
→ Send
```

## Shortcuts integration

Provide actions such as:

```text
Send Clipboard to Keep
Get Latest Keep Clipboard
Copy Latest Keep Item
Send Text to Device
```

Clipboard reads should occur only as part of explicit user actions.

Do not implement repeated timer-based clipboard polling.

Do not claim that iOS can silently provide unrestricted continuous clipboard synchronization.

---

# 16. Web and Samsung Tablet Interface

Add an Keep Clipboard page to the existing web dashboard.

Suggested route:

```text
/dashboard/clipboard
```

The interface should be browser-first and fully usable on:

- Desktop browsers.
- Samsung tablets.
- Android phones.
- iPads.
- iPhones.

It should not be mobile-first at the expense of desktop use.

## Main features

- Recent items.
- Search.
- Filters.
- Pinned items.
- Connected devices.
- Online presence.
- One-tap copy.
- Send to selected device.
- Delete.
- Clear history.
- Expiration indicator.
- Sensitivity label.
- Content-type label.
- Source device.
- Timestamp.
- Language metadata.
- Pause clipboard synchronization.
- Security settings.
- Retention settings.

## Tablet layout

Use touch-friendly controls with:

- Minimum comfortable touch targets.
- Two-column layout where space permits.
- Sticky search and filters.
- Optional details panel.
- Full-screen item viewer.
- PWA install support.
- Landscape and portrait layouts.
- DeX compatibility.

Example:

```text
┌────────────────────────────────────────────────────────────┐
│ Keep Clipboard               4 devices · 3 online       │
├────────────────────────────────────────────────────────────┤
│ Search clipboard history...                                │
├────────────────────────────┬───────────────────────────────┤
│ Recent items               │ Selected item                 │
│                            │                               │
│ kubectl get pods           │ kubectl get pods -n argocd   │
│ MacBook · now              │                               │
│                            │ [Copy] [Send] [Pin] [Delete] │
│ GitHub URL                 │                               │
│ Windows · 5 min            │ Source: MacBook              │
│                            │ Type: Shell command           │
│ Sensitive item             │ Created: just now            │
│ VS Code · 8 min            │                               │
└────────────────────────────┴───────────────────────────────┘
```

---

# 17. Security Requirements

Clipboard content is highly sensitive.

Treat this feature as security-sensitive from the beginning.

## Mandatory rules

- Never log clipboard payloads.
- Never log decrypted payloads.
- Never place plaintext secrets in analytics.
- Never include secret previews.
- Never expose Redis directly to clients.
- Never trust client-provided user IDs.
- Never persist raw device credentials.
- Never return another user’s clipboard items.
- Never allow a revoked device to reconnect.
- Enforce payload limits.
- Enforce rate limits.
- Enforce retention.
- Provide immediate device revocation.
- Provide “clear all clipboard data.”
- Support one-time items.
- Require explicit approval for new devices.
- Use secure transport.
- Use constant-time token comparison where appropriate.
- Protect pairing endpoints from brute force.
- Invalidate pairing sessions after exchange.

## Sensitive-content detection

Provide a modular detector for likely secrets.

Initial patterns may include:

```text
password=
passwd=
Authorization: Bearer
Bearer ...
AWS_SECRET_ACCESS_KEY
-----BEGIN PRIVATE KEY-----
-----BEGIN OPENSSH PRIVATE KEY-----
GitHub tokens
OpenAI-style API tokens
Firebase service account values
Database connection strings with credentials
JWT-like values
Long high-entropy tokens
```

Detection should influence behavior, not create false guarantees.

For likely sensitive items:

```text
Do not generate a plaintext preview.
Use short expiration by default.
Do not pin automatically.
Do not send automatically unless explicitly allowed.
Require user confirmation on mobile.
Avoid notifications containing content.
```

## Secret modes

Support:

```text
Send once
Keep for 5 minutes
Keep for 1 hour
Use normal retention
Pin explicitly
Do not synchronize
```

---

# 18. Encryption Design

Do not claim end-to-end encryption unless it is actually implemented correctly.

Implement in two stages.

## Stage 1

- TLS for transport.
- Existing Keep server-side security.
- Encrypted infrastructure storage where available.
- No plaintext payloads in logs.
- Strict access control.
- Short retention.

## Stage 2

Introduce client-side envelope encryption.

Possible model:

1. Each user has a clipboard encryption key.
2. Device pairing securely provisions or unwraps the user key.
3. Payloads are encrypted on the originating device.
4. BFF stores encrypted payloads.
5. Authorized devices decrypt locally.
6. Server may retain only minimal safe metadata.
7. Key rotation is versioned.
8. Device revocation prevents future key access.

Do not invent custom cryptography.

Use established authenticated encryption such as:

```text
AES-256-GCM
```

or platform-equivalent secure libraries.

Include:

```text
encryptionVersion
keyVersion
nonce
ciphertext
authenticationTag
associatedData
```

Bind associated data to:

```text
userId
itemId
originDeviceId
createdAt
contentType
```

Before implementing client-side encryption, write a concise threat model and document recovery and device-revocation behavior.

---

# 19. Search and Preview

Search is difficult when payloads are client-side encrypted.

Plan for two modes.

## Server-readable mode

Server can index normalized content for search.

This is simpler but not end-to-end encrypted.

## End-to-end encrypted mode

Options:

- Search only local cached content.
- Store explicitly generated encrypted search tokens.
- Limit server-side search to metadata.
- Download recent encrypted records and search locally.
- Avoid claiming full remote content search.

Do not silently weaken encryption merely to keep server-side search.

For the first release, metadata search is acceptable:

```text
Device
Content type
Language
Creation time
Pinned state
Sensitivity
Safe preview
```

---

# 20. Content Types and Storage

## MVP

Support:

```text
text
url
code
json
command
```

## Later

Support:

```text
image
file
PDF
rich text
```

Do not store large binary data directly in Redis.

For files and images:

1. Encrypt client-side where enabled.
2. Store blob in the existing configured object storage, Firebase Storage, or Keep-supported storage.
3. Store metadata and short-lived references in Redis.
4. Enforce upload limits.
5. Use expiration cleanup.
6. Validate MIME type.
7. Never trust filename extensions.
8. Do not render unsafe content directly.

---

# 21. Configuration

Add environment variables using existing Keep naming conventions.

Suggested configuration:

```dotenv
KEEP_CLIPBOARD_ENABLED=true

KEEP_CLIPBOARD_DEFAULT_TTL_SECONDS=604800
KEEP_CLIPBOARD_ONE_TIME_TTL_SECONDS=600
KEEP_CLIPBOARD_MAX_HISTORY_ITEMS=500
KEEP_CLIPBOARD_MAX_TEXT_BYTES=262144
KEEP_CLIPBOARD_MAX_PINNED_ITEMS=100

KEEP_CLIPBOARD_PAIRING_TTL_SECONDS=300
KEEP_CLIPBOARD_PRESENCE_TTL_SECONDS=60
KEEP_CLIPBOARD_DEDUPE_TTL_SECONDS=30

KEEP_CLIPBOARD_RATE_LIMIT_PER_MINUTE=120

KEEP_CLIPBOARD_REALTIME_TRANSPORT=sse
KEEP_CLIPBOARD_ENCRYPTION_MODE=server-protected
KEEP_CLIPBOARD_SENSITIVE_DETECTION_ENABLED=true

KEEP_CLIPBOARD_ALLOW_AUTO_SEND=true
KEEP_CLIPBOARD_ALLOW_AUTO_RECEIVE=true
```

Validate configuration at startup.

Do not silently use insecure defaults in production.

---

# 22. Observability

Add operational metrics without recording clipboard content.

Useful metrics:

```text
clipboard_items_created_total
clipboard_items_deleted_total
clipboard_items_consumed_total
clipboard_items_expired_total
clipboard_items_rejected_total

clipboard_active_devices
clipboard_connected_clients
clipboard_pairing_started_total
clipboard_pairing_approved_total
clipboard_pairing_rejected_total

clipboard_delivery_latency_ms
clipboard_payload_size_bytes
clipboard_stream_lag
clipboard_reconnect_total
clipboard_duplicate_suppressed_total
clipboard_sensitive_detected_total
```

Logs may include:

```text
requestId
userIdHash
deviceId
itemId
contentType
byteLength
sensitivity
eventType
deliveryLatencyMs
errorCode
```

Logs must not include:

```text
payload
decryptedPayload
token
raw pairing code
authorization header
private key
plaintext preview for sensitive items
```

---

# 23. Failure Handling

Handle:

- Redis unavailable.
- Firebase token expired.
- Device token expired.
- Device revoked.
- Pairing expired.
- Network disconnected.
- Duplicate event.
- Malformed encrypted envelope.
- Payload too large.
- History limit reached.
- Stream cursor too old.
- Client clock incorrect.
- Client reconnect.
- Partial object-storage upload.
- Encryption-key mismatch.
- Unsupported client version.

Use stable error codes such as:

```text
CLIPBOARD_DISABLED
CLIPBOARD_ITEM_NOT_FOUND
CLIPBOARD_PAYLOAD_TOO_LARGE
CLIPBOARD_RATE_LIMITED
CLIPBOARD_DEVICE_REVOKED
CLIPBOARD_PAIRING_EXPIRED
CLIPBOARD_PAIRING_ALREADY_USED
CLIPBOARD_INVALID_ENCRYPTION_ENVELOPE
CLIPBOARD_UNSUPPORTED_CONTENT_TYPE
CLIPBOARD_HISTORY_LIMIT
CLIPBOARD_SYNC_CURSOR_INVALID
```

Provide user-friendly client messages while preserving technical details in safe logs.

---

# 24. Testing Requirements

## Unit tests

Cover:

- Schema validation.
- Retention calculation.
- Sensitivity detection.
- Preview generation.
- Hash generation.
- Deduplication.
- Device authorization.
- Pairing expiration.
- Token hashing.
- History trimming.
- Loop-prevention state.
- Encryption envelope parsing.

## Integration tests

Cover:

- Authenticated web user creates item.
- Paired device creates item.
- Unauthorized device is rejected.
- Revoked device is rejected.
- Item appears in history.
- Stream event is produced.
- Item expires.
- Pinned item survives ordinary cleanup.
- One-time item is removed after consumption.
- Duplicate item is suppressed.
- Pairing code cannot be reused.
- User cannot read another user’s items.

## End-to-end tests

Cover:

```text
VS Code → BFF → web dashboard
Mac companion → BFF → Windows companion
Web dashboard → Android app
Android Sharesheet → VS Code
Device revocation → immediate access loss
Offline client → reconnect → resume from cursor
Remote item → local clipboard → no echo loop
```

---

# 25. Delivery Phases

## Phase 1 — Keep Clipboard Core

Implement:

- Clipboard domain module.
- Redis repository.
- Create/list/delete/pin/consume APIs.
- Web dashboard.
- Tablet-responsive UI.
- Retention.
- History trimming.
- Sensitivity detection.
- Safe logging.
- Feature flag.

Acceptance:

- A signed-in user can manually add clipboard text.
- The item appears in history.
- The user can copy, pin, consume, and delete it.
- History survives application restart through Redis.
- Items expire correctly.

## Phase 2 — VS Code Extension

Implement:

- Pair extension as device.
- Send selection.
- Send clipboard.
- Remote history Quick Pick.
- Copy or insert remote item.
- Secure credential storage.
- Sync event notifications.
- Loop and duplicate prevention.

Acceptance:

- A VS Code selection appears in Keep Clipboard.
- A web-created item can be inserted into the active editor.
- Credentials are not stored in plaintext.
- Sensitive previews are hidden.

## Phase 3 — Real-Time Sync and Device Management

Implement:

- Redis Stream event flow.
- SSE or WebSocket transport.
- Cursor resume.
- Presence.
- Device dashboard.
- Rename and revoke.
- Token rotation.
- Delivery acknowledgement.

Acceptance:

- Connected clients receive events promptly.
- Reconnecting clients resume correctly.
- Revoked devices lose access immediately.
- No event is silently lost because of a brief disconnect.

## Phase 4 — macOS and Windows Companion

Implement:

- Clipboard watcher.
- Tray/menu-bar UI.
- Manual receive.
- Optional automatic send.
- Optional automatic receive.
- Global shortcut.
- Start at login.
- Secure credential storage.
- Loop prevention.

Acceptance:

```text
Copy on Mac
→ item reaches Keep
→ Windows receives event
→ user selects item
→ item is placed in Windows clipboard
→ item is not echoed back
```

## Phase 5 — Android and Samsung Companion

Implement:

- Android app.
- Tablet UI.
- Sharesheet.
- Tap-to-copy.
- Explicit clipboard-send action.
- Notifications.
- Biometric protection.
- Optional Quick Settings tile.

Acceptance:

```text
Share text from Android app
→ choose Keep
→ item reaches Keep
→ appears in VS Code and desktop clients
```

And:

```text
Select Keep item
→ tap Copy
→ paste into another Android app
```

## Phase 6 — iPhone and iPad

Implement:

- SwiftUI app.
- Share Extension.
- Tap-to-copy.
- Explicit paste-and-send.
- Shortcuts/App Intents.
- Biometric protection.

## Phase 7 — Client-Side Encryption

Only after a threat model and key lifecycle design are approved.

Implement:

- Device key provisioning.
- Envelope encryption.
- Key versioning.
- Rotation.
- Device revocation semantics.
- Recovery strategy.
- Local decryption.

---

# 26. Explicit Non-Goals for the MVP

Do not implement initially:

- Large file synchronization.
- Video synchronization.
- Unlimited history.
- Team-shared clipboards.
- Public clipboard links.
- Internet-wide anonymous access.
- Custom Android keyboard.
- Accessibility-service clipboard scraping.
- Silent continuous iOS clipboard monitoring.
- Complex server-side encrypted-content search.
- Unreviewed custom cryptography.
- Automatic synchronization of likely secrets.
- Automatic replacement of every device clipboard by default.

---

# 27. Final MVP Acceptance Criteria

The feature is ready for its first useful release when:

1. Keep’s existing BFF is the only synchronization server.
2. Redis stores history and durable sync events.
3. Existing Firebase authentication remains authoritative.
4. Clipboard APIs follow existing Keep patterns.
5. The web interface works on desktop and Samsung tablet.
6. VS Code can send selected text.
7. VS Code can retrieve and insert a remote item.
8. A user can pair and revoke devices.
9. Clipboard items expire according to policy.
10. Pinned items persist.
11. Sensitive content does not expose previews.
12. Clipboard payloads never appear in logs.
13. Brief client disconnections do not lose events.
14. Duplicate events do not create clipboard loops.
15. The implementation is behind a feature flag.
16. Existing Keep vault behavior remains unaffected.
17. Existing tests continue to pass.
18. New unit, integration, and end-to-end tests are added.
19. Architecture and security decisions are documented.
20. Android and iOS limitations are represented honestly in UI and documentation.

---

# 28. Required Documentation

Create or update:

```text
docs/clipboard/overview.md
docs/clipboard/architecture.md
docs/clipboard/protocol.md
docs/clipboard/security.md
docs/clipboard/device-pairing.md
docs/clipboard/platform-limitations.md
docs/clipboard/testing.md
docs/clipboard/operations.md
```

The platform-limitations document must explain:

- Why Android background clipboard reads are restricted.
- Why the Android Sharesheet is preferred.
- Why iOS requires explicit user actions.
- Why desktop clients can provide deeper automation.
- Why automatic receiving is opt-in.
- Why clipboard content requires short retention and strict security.

---

# 29. Implementation Instructions for the Agent

Before modifying code:

1. Inspect the repository structure.
2. Identify existing BFF route patterns.
3. Identify Redis abstractions and key-prefix conventions.
4. Identify Firebase session verification.
5. Identify authorization utilities.
6. Identify logger and error conventions.
7. Inspect the VS Code extension architecture.
8. Identify existing shared packages.
9. Identify UI component and responsive-design conventions.
10. Identify test frameworks and CI requirements.

Then produce:

1. A concise repository-specific implementation plan.
2. A list of files to create or modify.
3. Any architectural conflicts or migrations.
4. A phased implementation.
5. Tests for each phase.
6. Documentation.
7. A final summary of completed work.

Do not rewrite unrelated parts of Keep.

Do not replace working authentication or Redis infrastructure.

Prefer incremental, reviewable changes.

Commit boundaries should approximately follow:

```text
feat(clipboard): add clipboard domain and Redis repository
feat(clipboard): add BFF routes and policies
feat(clipboard): add web clipboard dashboard
feat(devices): add device pairing and credentials
feat(vscode): add Keep Clipboard commands
feat(sync): add Redis Stream event delivery
feat(desktop): add macOS and Windows companion
docs(clipboard): document architecture and security
test(clipboard): add integration and end-to-end coverage
```

Begin by implementing Phase 1 and Phase 2. Keep later clients represented by shared protocol contracts and documented interfaces, but do not prematurely build all platforms before the BFF and VS Code flow are stable.

---

# Part III — Unified delivery roadmap

Keep's roadmap is the Part I platform phases, with the Keep Clipboard phases
inserted as an intentional divergence and numbered to continue the platform
sequence.

_Reconciled 2026-07-19: Keep Clipboard has shipped through the macOS companion
and an Android/Samsung direct-download public beta, alongside the web and VS
Code clients. Windows is implemented but remains behind its credential-storage,
signing, and device-validation release gate. The sections below track what's
shipped, what Keep Secrets still owes, the remaining clipboard/platform phases,
cross-cutting work, and the candidate feature backlog._

## Done (Keep Secrets)

- Foundation, domain/API, auth + TOTP MFA, encrypted vault, core data
  management (Part I Phases 1–5).
- Productivity (import/export/bulk/search/command palette) — Phase 6.
- Synchronization safety (versioning, 409, idempotency, atomic Redis CAS) —
  Phase 7.
- Device authorization + VS Code extension foundation — Phase 8.
- VS Code extension maturity (device-wrapped unlock, pull/push with concurrency
  safety, native UX) — Phase 11.

## Not yet done (Keep Secrets — the work we return to)

- **Revision history & restoration** — Part I "Next milestone" Stage E `[ ]`.
- **Activity records** — Stage F `[ ]`.
- **Comparison & history UI** — Phase 9.
- **Hardening** — Phase 10 (rules/integration/e2e tests, a11y, threat-model,
  secret-leak, performance, deployment docs).

## Divergence now (Keep Clipboard)

- **[x] Step 0 — Rebrand Envault → Keep** (Part 0 checklist). Done; legacy
  storage/crypto namespaces retained (0.6).
- **[x] Phase 12 — Keep Clipboard Core** (= Part II §25 Phase 1). Clipboard
  domain in `@keephq/domain` (sensitivity/preview/retention) + DTOs/scopes in
  `@keephq/api-contract`; `RedisClipboardRepository` (per-user CAS store under
  `envault:v1:clipboard:user:*`, dedupe/trim/pin limits); `/api/v1/clipboard/*`
  routes (list/create/get/delete/pin/unpin/consume), feature-flagged and
  auth-scoped; `client.clipboard.*`; tablet-responsive `/app/clipboard`
  workspace + nav; `NEXT_PUBLIC_KEEP_CLIPBOARD_ENABLED` + `KEEP_CLIPBOARD_*`.
  Unit-tested; `pnpm check` green; API smoke-tested. Real-time (Streams/SSE) and
  client-side encryption remain deferred (Phases 14/18).
- **[x] Phase 13 — Keep Clipboard in VS Code** (= Part II §25 Phase 2).
  `clipboard:read`/`clipboard:write` added to the device-authorization sign-in
  scopes (existing devices must re-sign-in to gain them); `apps/vscode-extension`
  gains `keep.clipboard.send` (selection or OS clipboard → item, with a
  Temporary/Once/Pin persistence pick, tagged `origin: vscode`) and
  `keep.clipboard.history` (Quick Pick over `client.clipboard.list()` with
  per-item Insert / Pin-Unpin / Delete buttons and copy-on-accept; one-time
  items are `consume`d on read). Reachable from palette, the Keep view title bar,
  editor right-click, and Quick Actions. Reuses the existing `SecretStorage`
  device token; `KeepApiError` 404/401/403 mapped to actionable messages.
  Manual receive, request/response only (no in-extension SSE yet). Typecheck +
  lint + esbuild + `pnpm check` green.

Then **return to Keep Secrets** (Stage E → F → Phase 9 → Phase 10).

## New product area — Keep Passwords

A third product area alongside Secrets and Clipboard: a personal, end-to-end
encrypted password manager intended to become the source of truth that replaces
scattered browser/app password stores. It reuses the existing zero-knowledge
vault key — no server-side key — and encrypts each entry whole on the client, so
the server only stores ciphertext. The detailed spec and phasing live in
[`docs/passwords.md`](passwords.md).

- **[x] P0a — Core vault (CRUD + copy).** `@keephq/crypto`
  `encryptPasswordItem`/`decryptPasswordItem` (AES-GCM, `keep:password` AAD);
  `PasswordItemDto` + create/update/import schemas, `passwords:read|write`
  scopes, and password error codes in `@keephq/api-contract`; `PasswordItem` +
  `PasswordRepository` in `@keephq/domain`; `RedisPasswordRepository` (per-item
  version, CAS `mutate`, idempotent import) on the vault state blob under the
  retained `envault:v1` namespace; `@keephq/firebase` re-export facade;
  `client.passwords.*`; `/api/v1/passwords[/:id|/import]` route handlers (auth →
  scope → parse → repo → result-union → envelope); the `/app/passwords`
  workspace (unlock gate, add/edit/delete, copy username & password, reveal,
  client-side search), sidebar + mobile nav, and `lib/password-entry.ts`.
  Feature-flagged with `NEXT_PUBLIC_KEEP_PASSWORDS_ENABLED`. Unit tests cover the
  crypto round-trip/AAD binding and repository CRUD + import idempotency;
  `lint` + `typecheck` + `test` green. Verified at the unit level only — no live
  end-to-end drive yet (needs Redis + Firebase + an unlocked vault).
- **P0b — Browser-CSV import & cleanup.** Parse Chrome/Edge/Firefox/Safari/
  Bitwarden/1Password CSV exports in the browser, preview and deselect junk rows,
  encrypt client-side, and commit through `client.passwords.import` (idempotent,
  chunked). Multi-select bulk delete for cleanup.
- **P1 — Health & hygiene.** Password generator; weak/reused/old analysis
  (client-side); HaveIBeenPwned breach check via k-anonymity; trash & restore;
  optional "re-authenticate to reveal" as a hardening gate over the shared unlock.
- **P2 — Richer items & reach.** Secure notes, cards, identities; TOTP; folder/tag
  maturity; surfacing in VS Code / desktop / mobile via device-auth + api-client.
- **P3 — Sharing.** Secure sharing and browser-extension autofill (aligns with
  the team/shared backlog below).

## Deferred Keep Clipboard phases (after the return, or as later divergences)

- **[x] Phase 14a — Real-time web sync** (part of Part II §25 Phase 3): durable
  per-user Redis Stream (`envault:v1:clipboard:user:*:stream`, `MAXLEN`-trimmed)
  appended on every mutation via a best-effort `emitClipboardEvent`;
  `ClipboardEventLog` in `@keephq/redis` (append / `latestCursor` / exclusive
  `readSince`); `GET /api/v1/clipboard/events` bounded SSE (~25s, `maxDuration` 30) tailing the stream; the web workspace subscribes with `EventSource` and
  applies idempotent deltas (upsert-by-id, once-consume removal) — cursor resume
  is automatic via `Last-Event-ID`. `KEEP_CLIPBOARD_STREAM_MAXLEN` config; event
  payloads carry sanitized metadata only. Unit-tested; `pnpm check` green.
  Transport is a 1s server-side stream poll (non-blocking, serverless-safe), not
  blocking `XREAD` — a later optimization if sub-second latency is needed.
- **Phase 14b — Device management** (rest of Part II §25 Phase 3): presence,
  device dashboard (rename/revoke), delivery acknowledgement, `device.revoked`
  events. **Now unblocked** — web, VS Code, and macOS (15a) all emit, so a device
  dashboard + revoke is both useful and security-relevant (revoke a lost Mac).
  High priority in the sequencing below.
- **[x] Phase 15a — macOS desktop agent** (Tauri) — Part II §25 Ph 4, macOS
  half. `apps/keep-desktop` is a Tauri menu-bar app: polls the clipboard (~1s),
  auto-sends new copies as `origin: macos` via device-auth + `POST
/clipboard/items`, with a local secret-guard (`@keephq/domain`
  `detectSensitivity`), Pause toggle, start-at-login (autostart LaunchAgent),
  single-instance guard, first-run window, and Keep-branded icons (generated
  from `apps/website/app/icon.svg`). API via `tauri-plugin-http` (bypasses
  webview CORS); token in the Tauri store; builds to `.app`/`.dmg`. **Distributed
  live** from the website `/download` page (linked from login + app sidebar);
  unsigned, so users clear quarantine with `xattr` (documented in-page).
  Send-only. Cross-cutting remainders tracked under "Desktop hardening" below.
- **Phase 15b — Windows desktop companion** — same `apps/keep-desktop` codebase.
  `tauri-plugin-clipboard-manager` + system-tray + `tauri-plugin-autostart` all
  support Windows; the watch loop, pairing, and secret-guard are shared. Windows
  has no macOS-style concealed-clipboard marker, so it relies on the regex
  secret-guard. Needs a Windows build host (or a CI Windows runner —
  cross-compiling from macOS is impractical) and an Authenticode cert to avoid
  SmartScreen warnings. **Scope decision (2026-07-18): this phase is Clipboard
  only.** Ship the planned native companion capabilities: clipboard watching,
  send and manual receive/history, optional loop-guarded auto-receive, system
  tray, start-at-login, secure Windows Credential Manager storage, pairing and
  revocation. Do not add Keep Secrets project/environment browsing, secret
  editing, vault unlock, or dotenv pull/push to the Windows app in this phase.
- **Phase 16 — Android / Samsung companion (public beta shipped 2026-07-19)** — Part II §25 Ph 5. Android
  restricts background clipboard reads (10+), so unlike desktop this is
  **share-to-Keep first** (a Share-sheet target → create item) plus tap-to-copy
  history — not silent auto-capture. Receive via foreground SSE / FCM push.
  Samsung: DeX + large-screen tablet UI (the web tablet layout already covers
  browsers; a native app adds share/receive + a Quick Settings tile). Likely
  Tauri v2 mobile (reuse the webview UI + `@keephq/api-client` + `@keephq/domain`)
  or native Kotlin. Needs the mobile build toolchain, Play Store, biometric lock,
  and server FCM integration for background receive. **Scope decision
  (2026-07-18): this phase is Clipboard-first and does not include Keep Secrets.**
  The shipped beta pairs through the browser, manually sends text, browses
  clipboard history, and taps to copy, with signed direct-APK distribution.
  Follow-ups are an Android Sharesheet target, notifications, biometric lock,
  Samsung tablet/DeX validation, an optional Quick Settings tile, and research
  into supported Samsung clipboard APIs. Keep will not bypass Android privacy
  controls or depend on Samsung-only behavior.
- **Phase 17 — iPhone / iPad companion** (Share Extension, App Intents) — Ph 6.
  iOS blocks background clipboard access and shows a paste banner, so it is
  share-driven like Android. Reuses the same server + contracts.
- **Phase 18 — Client-side clipboard encryption** (threat model first;
  reuse `@keephq/crypto` key-wrapping) — Ph 7.
- **Phase 19 — Wear OS / Samsung Galaxy Watch companion** — a deliberately
  small Clipboard companion, initially non-standalone and paired with the Keep
  Android app. Native Kotlin + Compose for Wear OS; sanitized recent previews;
  explicit send and phone-side copy requests; privacy-safe notifications; a
  small Tile; scoped session transfer/revocation through the Wear OS Data Layer.
  No Keep Secrets browsing, silent clipboard monitoring, sensitive lock-screen
  content, watch-face clipboard history, Accessibility workarounds, or
  Samsung-only dependency. A direct-cloud standalone mode is a later evaluation
  after power, authentication, revocation, and secure-storage work. The detailed
  plan and acceptance criteria live in `docs/wear-os.md`.

## Desktop hardening & distribution (cross-cuts 15a/15b)

- **Keychain / Credential-Manager token storage** — replace the Tauri store
  (plaintext-ish on disk) with the OS secret store. The one real security gap in
  the otherwise-shippable v1.
- **Native clipboard signals** — read `changeCount` + concealed/sensitive
  pasteboard types (macOS) so password-manager copies are skipped at the OS level
  rather than only by regex; Windows format/exclusion equivalents.
- **Receive / auto-place** — hold the SSE connection open (desktop is long-lived,
  no serverless bound) to show items from other devices live; click-to-copy, with
  opt-in, loop-guarded auto-place into the local clipboard.
- **Signing + notarization** — macOS Developer ID + notarization and Windows
  Authenticode so downloads open with a normal double-click (removes the `xattr`
  step). **Deferred by decision (2026-07-18)**; the `xattr` note ships meanwhile.
  Requires an Apple Developer account ($99/yr) / Authenticode cert.
- **Release hosting + auto-update** — move binaries out of git into GitHub
  Releases; wire `tauri-plugin-updater` for in-app updates.

## VS Code extension — planned improvements

**Environments (secrets):**

- Pre-push diff / compare view; conflict resolution surfaced in-editor.
- Status-bar indicator of the bound project/environment; auto-pull on folder open.
- Quick add/edit variable; secret masking in the `.env` editor; multi-root support.

**Clipboard:**

- In-extension live updates (hold SSE) so history refreshes without re-running.
- Receive notifications ("new item from macOS"); a "paste last item" command.
- Keybindings for send/history; language-aware insert (wrap code, keep indent).

## Server follow-ups

- **Device-approval URL** — build `verificationUri` from a configured public base
  URL, not the request `Origin` (which is `tauri://localhost` for Tauri, and
  wrong for any non-browser client). Currently corrected client-side in the
  desktop app; the server-side fix benefits every future client.
- **Phase 14b device endpoints** — presence, list/rename/revoke, delivery ack.

## Candidate new Keep features (backlog, unprioritized)

- **`keep` CLI** — terminal client: pull/push env to `.env`, and `keep copy` /
  `keep paste` for the clipboard from the shell (reuses device-auth +
  `@keephq/api-client`).
- **Team / shared** environments and clipboards (currently an MVP non-goal) — the
  main multi-user growth path; needs an authorization model.
- **Browser extension** clipboard client (Chrome/Firefox).
- **Clipboard organization** — search, tags/folders, filters beyond preview.
- **Web push / bell** for clipboard + secret events.
- **Secret lifecycle** — rotation reminders, per-variable expiry, cross-env
  references, templates.

## Recommended sequencing (from here)

1. **Finish Windows Clipboard distribution** — Android/Samsung has shipped as a
   direct-download public beta. Windows still needs Credential Manager, signed
   installers, and clean-device testing before its independent release gate.
2. **Android/Samsung beta enhancements** — Sharesheet, notifications,
   biometrics, DeX/tablet validation, optional Quick Settings, and supported
   Samsung clipboard integration research. Silent background capture remains
   explicitly out of scope.
3. **Phase 14b device management** — now that web, VS Code, and macOS all emit, a
   device dashboard + revoke is both useful and a security necessity.
4. **Return to Keep Secrets** — Stage E (revision history) → F (activity) →
   Phase 9 (comparison/history UI) → Phase 10 (hardening). The platform still
   owes these before it is "done".
5. **Signing + notarization** — when distributing beyond your own devices.
6. **Phase 18 — client-side clipboard encryption** — after a threat model.
7. **Phase 19 — Wear OS / Galaxy Watch** — begin only after Android Sharesheet,
   notifications, and device revocation provide a stable phone-side foundation;
   follow the staged plan in `docs/wear-os.md`.

## Phase attention summary (2026-07-19)

| Area                 | State                      | Next attention                                                        |
| -------------------- | -------------------------- | --------------------------------------------------------------------- |
| Keep Secrets core    | Shipped                    | Revision history, activity, comparison UI, hardening                  |
| Keep Passwords       | P0a shipped (web)          | Browser-CSV import + cleanup (P0b); generator, breach check (P1)      |
| Web Clipboard        | Shipped                    | Operational hardening and client-side encryption threat model         |
| VS Code Clipboard    | Shipped, request/response  | Live receive, notifications, paste-last, keybindings                  |
| macOS Clipboard      | Shipped                    | Receive/auto-place, native sensitivity signals, notarization, updater |
| Windows Clipboard    | Implemented, release gated | Credential Manager, Authenticode, clean-device validation             |
| Android/Samsung      | Public beta                | Sharesheet, notifications, biometrics, DeX, Quick Settings            |
| Device platform      | Partial                    | Presence, rename, revoke, delivery acknowledgement                    |
| Wear OS/Galaxy Watch | Planned                    | W0 feasibility and threat model after Android foundations             |
| iOS/iPadOS           | Planned                    | Share Extension and explicit paste-driven UX                          |

## Suggested commit boundaries (historical — Step 0 + Phases 12–13, shipped)

```text
chore(brand): rename Envault -> Keep across packages, env, redis prefix
feat(clipboard): add clipboard domain, schemas, Redis repository
feat(clipboard): add /api/v1/clipboard routes, policy, sensitivity detection
feat(clipboard): add web clipboard dashboard (tablet-responsive)
feat(devices): add clipboard:* scopes to device authorization
feat(keep-vscode): add Keep Clipboard commands
docs(clipboard): overview, architecture, security, platform-limitations
test(clipboard): unit + integration coverage
```

## Documentation to add (Part II §28, under Keep naming)

```text
docs/clipboard/overview.md
docs/clipboard/architecture.md
docs/clipboard/protocol.md
docs/clipboard/security.md
docs/clipboard/device-pairing.md        # cross-links docs/device-authorization.md
docs/clipboard/platform-limitations.md
docs/clipboard/testing.md
docs/clipboard/operations.md
```

---

## Provenance

- **Supersedes:** `Plan.md` (Envault platform spec) and `ClipboardSyncPlan.md`
  (Envault clipboard spec) — both removed on consolidation.
- Part I is `Plan.md` folded in and rebranded, completion state preserved.
- Part II-B is `ClipboardSyncPlan.md` rebranded; Part II-A is the new
  repo-reconciliation layer that overrides it.
