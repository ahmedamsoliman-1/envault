# Envault — Secure Environment Variable Management Platform

You are a senior full-stack engineer, software architect, security engineer and product designer.

Build a production-quality platform called **Envault**.

> **Envault — Your environments, organized and protected.**

Envault allows developers to securely manage environment variables and secrets across multiple projects and environments.

The initial product is a modern Next.js web application. However, the architecture must support future clients such as:

* A VS Code extension.
* A command-line interface.
* A desktop application.
* Other approved integrations.

Do not create a superficial prototype. Build a maintainable, typed, testable and security-conscious application.

---

# 1. Core product requirements

Users must be able to:

* Register using email and password.
* Verify their email address.
* Log in and log out.
* Reset their password.
* Enable TOTP multi-factor authentication.
* Use authenticator applications such as Microsoft Authenticator or Google Authenticator.
* Complete an MFA challenge during login.
* Create and unlock an encrypted vault.
* Create multiple projects.
* Create multiple environments under each project.
* Add, edit, rename, copy and delete environment variables.
* Hide sensitive values by default.
* Reveal values temporarily.
* Copy values to the clipboard.
* Import `.env` files and pasted dotenv content.
* Export environments in supported formats.
* Search and filter variables.
* Select multiple variables.
* Perform bulk updates.
* Copy variables between environments.
* Compare two environments.
* View revision history.
* Restore previous revisions.
* Review non-sensitive activity logs.
* Configure automatic vault locking.
* Use light and dark themes.

The first release is for individual users.

Do not implement team collaboration yet, but structure the platform so organizations, memberships, roles and shared vaults can be added later.

---

# 2. Required technology stack

Use:

* Next.js with the App Router.
* React.
* TypeScript with strict mode.
* `pnpm`.
* A `pnpm` workspace.
* Turborepo where useful.
* Tailwind CSS.
* shadcn/ui.
* Radix UI primitives.
* Lucide icons.
* Firebase Authentication.
* Firebase Authentication with Identity Platform.
* Cloud Firestore.
* Firebase Admin SDK.
* Firebase App Check integration points.
* Firebase Emulator Suite.
* Zod.
* React Hook Form.
* TanStack Table.
* Sonner.
* Vitest.
* Playwright.
* Firestore Rules Unit Testing.

Do not introduce another primary database.

Do not use Redux unless there is a strong architectural requirement.

---

# 3. Architecture requirements

Envault must use an **API-first, multi-client architecture**.

The initial web application uses Next.js, but the platform must not be designed as a web-only Firestore application.

Use Next.js Route Handlers as:

* A Backend for Frontend for the website.
* A versioned application API for future clients.
* An authorization boundary.
* A validation boundary.
* A stable interface over Firestore.

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
Envault /api/v1
```

Do not place important business logic directly inside:

* React components.
* Route Handlers.
* Server Actions.
* Firestore repositories.

Route Handlers should handle only:

* Authentication.
* Authorization context.
* Request parsing.
* Input validation.
* Application-service invocation.
* Error-to-HTTP mapping.
* Typed responses.

---

# 4. Monorepo structure

Use a structure similar to:

```text
envault/
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

* Route Handlers.
* The website.
* The typed API client.
* Future VS Code extension.
* Future CLI.
* Tests.

Do not manually duplicate request or response types.

---

# 7. Typed API client

Create a reusable client in:

```text
packages/api-client
```

Example usage:

```typescript
const client = new EnvaultClient({
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

Envault must use client-side encryption.

Plaintext environment-variable values must never be sent to Firestore or the Envault API.

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

* AES-256-GCM for payload encryption.
* A cryptographically secure random IV for every encryption operation.
* A separate random vault data-encryption key.
* PBKDF2-SHA-256 for initial passphrase-based key derivation.
* A unique random salt per user.
* A configurable and documented iteration count.
* Authenticated additional data.

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

   * The vault is manually locked.
   * The user signs out.
   * The auto-lock timer expires.
   * The page is closed where practical.
   * Authentication becomes invalid.

Never store the vault passphrase.

Never store an unwrapped vault key in:

* Firestore.
* Cookies.
* localStorage.
* sessionStorage.
* IndexedDB.
* Logs.
* Analytics.

---

# 11. Recovery key

During vault creation:

* Generate a high-entropy recovery key.
* Display it once.
* Require the user to confirm it has been saved.
* Use it to create a second wrapped copy of the vault key.
* Do not store the raw recovery key.

Clearly explain:

* Firebase password reset does not reset the vault passphrase.
* Loss of both the passphrase and recovery key means encrypted data cannot be recovered.
* Envault administrators cannot decrypt the vault.

Do not create an administrative decryption backdoor.

---

# 12. Authentication requirements

Use Firebase Authentication.

Implement:

* Email and password registration.
* Email verification.
* Login.
* Logout.
* Password reset.
* Authentication-state restoration.
* Session revocation behavior.
* Recent-login checks.
* Reauthentication for sensitive operations.
* TOTP MFA enrollment.
* TOTP MFA challenge.
* TOTP MFA removal.
* Clear error handling.

Users may register before verifying their email, but unverified users must not be able to:

* Create a vault.
* Read vault metadata.
* Read projects.
* Read environments.
* Read ciphertext.
* Create or update vault data.

Create a dedicated verification page with:

* Verification status.
* Resend verification email.
* Refresh verification state.
* Change account action.
* Logout action.

---

# 13. TOTP MFA

Use Firebase Authentication with Identity Platform.

Support authenticator applications including:

* Microsoft Authenticator.
* Google Authenticator.
* Authy.
* Compatible TOTP applications.

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

* HTTP-only cookies.
* Secure cookies in production.
* SameSite settings.
* CSRF protection for state-changing browser requests.
* Session expiration.
* Session revocation checks where appropriate.

Do not rely only on client-side React authentication state.

---

# 15. Future VS Code extension authentication

Prepare the platform for browser-based device authorization.

The expected future flow is:

```text
1. User runs “Envault: Sign In” in VS Code.
2. Extension creates a device authorization.
3. Extension opens the system browser.
4. User signs in through the Envault website.
5. User completes Firebase MFA.
6. User approves the device.
7. Extension exchanges a short-lived authorization code.
8. Extension receives a revocable device session.
9. Extension stores credentials in VS Code SecretStorage.
```

The extension must never request or store:

* Firebase password.
* TOTP secret.
* Raw recovery key.
* Long-lived unprotected credentials.

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

* Short-lived.
* Single-use.
* Random.
* Hashed before persistence.
* Bound to the requesting client.
* Invalidated after exchange.

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

* Their vault passphrase.
* Or their recovery key.

Optional future convenience:

* Create a device-specific wrapped vault key.
* Store only the device-wrapped material in VS Code SecretStorage.
* Allow the user to revoke the device from Envault.
* Invalidate the device-specific wrapping record when revoked.

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

* Bulk updates.
* Imports.
* Synchronization.
* Device authorization exchange.
* Revision restore.

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

* Create.
* Update.
* Rename.
* Archive.
* Restore.
* Duplicate.
* Delete.

Environment actions:

* Create.
* Update.
* Rename.
* Duplicate.
* Archive.
* Restore.
* Delete.
* Import.
* Export.
* Compare.
* Synchronize.
* Copy selected variables.

Environment kinds:

```typescript
type EnvironmentKind =
  | "local"
  | "development"
  | "testing"
  | "staging"
  | "production"
  | "custom";
```

Production environments should have a clear warning treatment.

Sensitive production operations may require:

* Recent authentication.
* MFA.
* Confirmation using the environment name.

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

* Selection.
* Key.
* Masked value.
* Visibility.
* Tags.
* Updated time.
* Actions.

Support:

* Inline editing.
* Keyboard navigation.
* Add-variable dialog.
* Search.
* Sorting.
* Filtering.
* Tag filtering.
* Visibility filtering.
* Pagination or virtualization.
* Optimistic UI.
* Safe rollback.
* Copy key.
* Copy value.
* Reveal temporarily.
* Rename.
* Duplicate.
* Copy to another environment.
* View revisions.
* Delete.

Secret values must be masked by default.

Do not place plaintext values in:

* HTML title attributes.
* URL query parameters.
* Analytics events.
* Error reports.
* Browser logs.

---

# 23. Bulk operations

Users must be able to select variables and:

* Delete them.
* Copy them.
* Move them.
* Add tags.
* Remove tags.
* Change visibility.
* Add a prefix.
* Remove a prefix.
* Convert keys to uppercase.
* Find and replace key text.
* Export selected variables.

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

* Overwrite existing variables.
* Skip existing variables.
* Import only new variables.
* Review conflicts individually.

Chunk large operations safely.

Return progress information.

Use idempotency keys.

Use expected environment versions.

---

# 24. Import formats

Support:

* `.env`
* `.env.local`
* `.env.development`
* `.env.production`
* Pasted dotenv content.
* JSON objects.
* Shell-style `export KEY=value`.

Support:

* Empty values.
* Quoted values.
* Escaped characters.
* Comments.
* Duplicate-key detection.
* Variable-reference preservation.
* Safely parseable multiline values.

Do not execute:

* Shell commands.
* Command substitutions.
* JavaScript.
* Templates.
* Arbitrary expressions.

Treat suspicious content as literal text and show a warning.

---

# 25. Export formats

Support:

* `.env`
* JSON.
* Shell exports.
* Docker Compose environment snippet.
* Kubernetes Secret YAML.

Export must occur locally after decryption.

Do not send plaintext export content to the server.

Do not store generated exports in Firestore.

Clearly explain that Kubernetes base64 values are encoded, not encrypted.

---

# 26. Environment comparison

Allow users to compare any two environments.

Classify variables as:

* Identical.
* Different value.
* Missing from source.
* Missing from destination.
* Different visibility.
* Different tags or metadata.

Support:

* Copy source to destination.
* Copy destination to source.
* Synchronize selected.
* Ignore selected differences.
* Export a difference report.

Comparison should occur locally after decrypting ciphertext.

Do not persist plaintext comparison results.

---

# 27. Revision history

Create revisions for:

* Variable creation.
* Value update.
* Key rename.
* Visibility update.
* Metadata update.
* Deletion.
* Restoration.

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

* Deny unauthenticated access.
* Deny access for unverified accounts.
* Enforce ownership.
* Prevent owner ID mutation.
* Prevent vault ID mutation.
* Validate document fields.
* Validate field types.
* Validate allowed enums.
* Limit arrays.
* Limit ciphertext sizes.
* Prevent cross-user access.
* Deny unknown document shapes where practical.

Use reusable rules functions.

Provide emulator tests for:

* Unauthenticated access.
* Unverified accounts.
* Owner access.
* Cross-user reads.
* Cross-user writes.
* Owner reassignment.
* Invalid fields.
* Invalid enums.
* Oversized ciphertext.
* Invalid batch writes.

Do not deploy permissive rules.

---

# 30. Activity logging

Record non-sensitive events:

* Login.
* Logout.
* MFA enrollment.
* MFA removal.
* Vault creation.
* Project creation.
* Environment creation.
* Variable creation.
* Variable update.
* Variable deletion.
* Import.
* Export request.
* Bulk update.
* Device authorization.
* Device session creation.
* Device session revocation.
* Revision restoration.

Never log:

* Plaintext variable values.
* Vault passphrases.
* Recovery keys.
* TOTP secrets.
* Encryption keys.
* Complete import content.
* Complete export content.
* Authentication tokens.

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

* Number of projects.
* Number of environments.
* Number of variables.
* Recently updated environments.
* Recent non-sensitive activity.
* Email verification status.
* MFA status.
* Vault lock status.
* Active devices.
* Quick project creation.
* Quick import action.

Do not retrieve or decrypt every variable to render the dashboard.

---

# 33. Visual direction

Create a modern and restrained interface inspired by:

* Linear.
* Vercel.
* Raycast.
* Modern password managers.

Do not copy their branding or exact layouts.

Requirements:

* Light and dark mode.
* Neutral surfaces.
* Restrained accent color.
* Subtle borders.
* Minimal shadows.
* Monospace font for variable keys and values.
* Strong accessibility.
* Clear keyboard focus.
* Responsive behavior.
* Desktop-optimized variable editor.
* Skeleton loading states.
* Empty states.
* Confirmation dialogs.
* Command palette using `Cmd/Ctrl + K`.
* Smooth but restrained transitions.
* Production warning indicators.
* Vault lock indicator.
* Unsaved-change indicators.
* Copy confirmations.

Avoid:

* Excessive gradients.
* Excessive glass effects.
* Oversized cards.
* Decorative motion.
* Hidden security states.

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

NEXT_PUBLIC_APP_NAME=Envault
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_APP_CHECK=false

SESSION_COOKIE_NAME=envault_session
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

* Unauthenticated.
* Forbidden.
* Email not verified.
* MFA required.
* Invalid MFA code.
* Recent authentication required.
* Vault locked.
* Incorrect vault passphrase.
* Invalid recovery key.
* Corrupt ciphertext.
* Unsupported encryption version.
* Invalid request.
* Duplicate variable.
* Environment version conflict.
* Idempotency conflict.
* Import parse error.
* Partial bulk-operation failure.
* Device authorization expired.
* Device authorization already used.
* Device session revoked.
* Firestore unavailable.

Map domain and application errors consistently to HTTP status codes.

Do not expose:

* Stack traces.
* Credentials.
* Internal Firestore paths.
* Ciphertext internals.
* Account-existence information.

---

# 36. Testing requirements

## Unit tests

Test:

* Dotenv parsing.
* Dotenv serialization.
* JSON import.
* Shell export parsing.
* Variable-key validation.
* Conflict detection.
* Bulk transformations.
* Environment comparison.
* Encryption and decryption.
* Wrong-key failure.
* IV uniqueness.
* Vault-key wrapping.
* Recovery-key wrapping.
* Browser and Node crypto compatibility.
* API schemas.
* API client.
* Environment version conflicts.
* Idempotency behavior.
* Device authorization expiry.
* Device authorization single use.

## Integration tests

Test:

* Route Handlers.
* Application services.
* Firestore repositories.
* Authentication middleware.
* Authorization.
* Versioned updates.
* Device authorization exchange.
* Session revocation.

## Firestore Rules tests

Test all ownership, verification and validation rules with the Emulator Suite.

## End-to-end tests

Test:

* Registration.
* Email-verification gating.
* Login.
* MFA enrollment.
* MFA challenge.
* Vault creation.
* Vault lock and unlock.
* Project creation.
* Environment creation.
* Variable creation.
* Bulk update.
* Import preview.
* Import commit.
* Comparison.
* Export.
* Revision restoration.
* Device approval page.
* Device session revocation.

Never use production Firebase resources in automated tests.

---

# 37. Documentation

Provide:

* `README.md`.
* Local setup instructions.
* Firebase project setup.
* Identity Platform setup.
* TOTP MFA setup.
* Firebase Emulator setup.
* Firestore rules deployment.
* Firestore indexes deployment.
* Environment-variable reference.
* Build and deployment instructions.
* API documentation.
* Typed client usage.
* Device-authorization design.
* Encryption protocol.
* Threat model.
* Data model.
* Architecture decisions.
* Future VS Code extension integration guide.

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

* Create the monorepo.
* Configure pnpm workspace.
* Configure Turborepo.
* Create the Next.js application.
* Create shared packages.
* Configure TypeScript.
* Configure linting and formatting.
* Configure UI foundation.
* Configure typed environment variables.
* Configure Firebase Emulator Suite.
* Add initial CI checks.

## Phase 2 — Domain and API foundation

* Define domain entities.
* Define application-service interfaces.
* Define repository interfaces.
* Define Zod API contracts.
* Implement typed API response helpers.
* Implement structured errors.
* Create `/api/v1`.
* Build the shared API client.

## Phase 3 — Authentication

* Registration.
* Email verification.
* Login.
* Logout.
* Password reset.
* Secure server sessions.
* Route protection.
* Reauthentication.
* TOTP enrollment.
* MFA challenge.
* Security settings.

## Phase 4 — Encrypted vault

* Vault creation.
* Passphrase derivation.
* Vault-key generation.
* Key wrapping.
* Recovery key.
* Browser crypto adapter.
* Node crypto adapter.
* Compatibility tests.
* Vault locking.
* Automatic locking.

## Phase 5 — Core data management

* Projects.
* Environments.
* Variables.
* Server-side repositories.
* Firestore rules.
* Firestore indexes.
* Variable editor.
* CRUD operations.
* Revision creation.

## Phase 6 — Productivity

* Dotenv parser.
* Import preview.
* Import execution.
* Export.
* Bulk actions.
* Search.
* Filters.
* Keyboard shortcuts.
* Command palette.

## Phase 7 — Synchronization safety

* Environment versioning.
* Expected-version writes.
* Firestore transaction checks.
* HTTP 409 conflicts.
* Conflict-resolution UI.
* Idempotency keys.
* Operation records.

## Phase 8 — Comparison and history

* Environment comparison.
* Difference actions.
* Revision history.
* Revision decryption.
* Revision restoration.
* Activity screen.

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

- [ ] Import parsing, preview and execution tests pass.
- [x] Imported plaintext is encrypted before any API request.
- [x] All export formats are generated locally.
- [x] Retried imports and bulk mutations do not duplicate changes.
- [ ] Stale import, bulk and restoration writes return HTTP 409.
- [ ] Revision history does not decrypt values while listing.
- [ ] Activity records contain no secret material.
- [ ] Lint, typecheck, unit tests and production build pass.

## Phase 9 — Device architecture

* Device authorization model.
* Device-session model.
* Device approval page.
* Device authorization endpoints.
* Token exchange.
* Session scopes.
* Device list.
* Device revocation.
* VS Code integration documentation.

## Phase 10 — Hardening

* Rules tests.
* Integration tests.
* End-to-end tests.
* Accessibility review.
* Threat-model review.
* Logging review.
* Secret-leak review.
* Performance review.
* Production build verification.
* Deployment documentation.

Do not skip foundational phases to build polished UI first.

---

# 40. Acceptance criteria

The project is complete only when:

* It builds without TypeScript errors.
* Linting passes.
* Unit tests pass.
* Integration tests pass.
* Firestore rules tests pass.
* Core Playwright tests pass.
* The website uses the typed API client.
* Core domain operations do not directly access Firestore from React components.
* API contracts are shared.
* APIs are versioned.
* No plaintext secret is sent to the server.
* No plaintext secret is stored in Firestore.
* No plaintext secret is persisted in browser storage.
* Browser and Node encryption implementations are compatible.
* Email verification is enforced.
* TOTP MFA works.
* Secure web sessions are implemented.
* Vault lock clears active in-memory key material.
* Import and export work.
* Bulk updates work.
* Version conflicts return HTTP 409.
* Idempotent retries do not duplicate changes.
* Environment comparison works.
* Revision restoration works.
* Device authorization is designed and implemented securely.
* Device sessions can be reviewed and revoked.
* A future VS Code extension can consume the same API, API client, contracts and encryption protocol.
* Light and dark themes work.
* The interface is polished and accessible.
* Setup and deployment documentation are complete.

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
