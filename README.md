# Keep

Keep is a secure, API-first platform for managing encrypted environment secrets,
personal passwords, and synchronized clipboard text across the devices and tools
where developers work.

The platform has three connected products:

- **Keep Secrets** organizes projects and environments, encrypts values on the
  client, and safely moves `.env` data between the web app and VS Code.
- **Keep Passwords** is a personal, end-to-end-encrypted password manager that
  reuses the same vault key; entries are encrypted whole on the client and the
  server only ever stores ciphertext. Web, feature-flagged. See
  [docs/passwords.md](docs/passwords.md).
- **Keep Clipboard** synchronizes short-lived text between the web, VS Code,
  macOS, Windows, and Android/Samsung clients while filtering likely secrets
  where the platform permits automatic clipboard observation.

Keep uses one identity, one device-authorization flow, one versioned API, and a
shared set of contracts and domain rules across every client.

## Platform status

| Surface                | Secrets                                                    | Passwords                                     | Clipboard                                                                  | Distribution                    |
| ---------------------- | ---------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------- |
| Web                    | Projects, environments, encrypted variables, import/export | Encrypted entries: add/edit/copy/search (P0a) | History, manual send, retention modes, live updates                        | Hosted application              |
| VS Code                | Device sign-in, pull/push `.env`, encrypted vault unlock   | —                                             | Send selection/clipboard, browse and insert history                        | VS Code Marketplace             |
| macOS                  | —                                                          | —                                             | Automatic send, likely-secret filtering, history and tap-to-copy           | Download page / GitHub Release  |
| Android & Samsung      | —                                                          | —                                             | Manual send, history and tap-to-copy                                       | Signed direct-download APK beta |
| Windows                | —                                                          | —                                             | Shared desktop companion implemented; signing and release hardening remain | Release gate closed             |
| Wear OS / Galaxy Watch | —                                                          | —                                             | Planned glance-and-action companion                                        | Future phase                    |
| iPhone / iPad          | —                                                          | —                                             | Planned share-driven companion                                             | Future phase                    |

Android does not silently monitor the clipboard in the background. Its current
beta deliberately uses explicit manual sending. Sharesheet support,
notifications, biometrics, DeX polish, and supported Samsung integrations are
future enhancements.

## Repository map

```text
apps/
  website/           Next.js web app, BFF, API routes, and download page
  vscode-extension/  VS Code Secrets and Clipboard client
  keep-desktop/      Shared Tauri client for macOS, Windows, and Android

packages/
  api-contract/      Versioned Zod request/response contracts
  api-client/        Typed client used by non-web surfaces
  application/       Use cases and application orchestration
  domain/            Infrastructure-independent product rules
  crypto/            Client-side encryption and key-wrapping protocol
  redis/             Primary repositories, atomic operations, and event streams
  firebase/          Authentication and retained Firebase integrations
  dotenv/            `.env` parsing and serialization
  config/            Shared configuration validation
  logger/            Structured, payload-safe logging
  test-utils/        Shared test helpers

docs/                Architecture, operations, security, releases, and roadmap
firebase/            Emulator configuration and local Firebase resources
```

## Architecture at a glance

```text
Web / VS Code / Native clients
        │
        ▼
@keephq/api-client + @keephq/api-contract
        │
        ▼
Next.js /api/v1 BFF ── authentication and policy
        │
        ▼
application services ── domain rules
        │
        ├── Redis repositories and clipboard streams
        └── Firebase authentication/integrations
```

Secret plaintext is encrypted and decrypted on trusted clients. Clipboard has
its own sensitivity, preview, retention, deduplication, and authorization rules;
client-side clipboard encryption remains a future hardening phase.

Legacy `envault:*` storage and cryptographic namespaces are intentionally
retained to protect compatibility after the product was renamed to Keep.

## Prerequisites

- Node.js 22.13 or newer; Node.js 24 LTS is recommended.
- pnpm 11.
- Java 21 for Firebase emulators and Android builds.
- Rust and the Tauri prerequisites for native development.
- Android Studio/SDK/NDK for Android; Xcode for macOS; a Windows runner or
  Windows workstation for Windows installers.

Copy `.env.example` to `.env` and provide the local Firebase and Redis settings
described there. Never commit service-account JSON, signing keys, keystores, or
production credentials.

## Start the platform locally

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The web application runs at `http://localhost:3000`; its health endpoint is
`http://localhost:3000/api/v1/health`.

To run the Firebase Emulator Suite when a workflow needs it:

```bash
pnpm emulators
```

## Component development

### Web and API

```bash
pnpm --filter @keephq/website dev
pnpm --filter @keephq/website typecheck
pnpm --filter @keephq/website test
pnpm --filter @keephq/website build
```

API routes live with the Next.js BFF, but transport schemas belong in
`@keephq/api-contract`, reusable calls in `@keephq/api-client`, product rules in
`@keephq/domain`, and persistence in the appropriate repository package.

### VS Code extension

```bash
pnpm --filter keep-vscode typecheck
pnpm --filter keep-vscode lint
pnpm --filter keep-vscode test
pnpm --filter keep-vscode build
```

Use the VS Code Extension Development Host for interactive authentication,
SecretStorage, editor commands, and `.env` workflow testing.

### macOS and Windows desktop client

```bash
pnpm --filter keep-desktop dev
pnpm --filter keep-desktop typecheck
pnpm --filter keep-desktop app:dev
pnpm --filter keep-desktop app:build
```

The UI and shared clipboard behavior live in `apps/keep-desktop/src`; native
Tauri commands and platform integration live in `apps/keep-desktop/src-tauri`.
Build installers on their target operating system. Do not treat a successful
web build as proof that native tray, startup, clipboard, credential storage, or
signing behavior works.

### Android and Samsung client

Initialize or run Android through Tauri from `apps/keep-desktop`:

```bash
pnpm tauri android dev
pnpm tauri android build --apk --ci
```

For signed testing, run the **Android signed test APK** GitHub Actions workflow.
Install the new APK over the previous signed version to verify upgrade and
session migration, then test browser approval, restart, history, copy, manual
send, and sign-out/reconnect. Keep the Android release keystore permanently;
Android rejects upgrades signed by another key.

### Shared packages

Use pnpm filters while iterating, then run the repository-wide checks before
merging:

```bash
pnpm --filter @keephq/domain test
pnpm --filter @keephq/api-contract typecheck
pnpm --filter @keephq/api-client test
pnpm check
```

## Quality and contribution flow

1. Start from an up-to-date branch and keep the change scoped to one capability.
2. Update contracts first when an API shape changes.
3. Keep domain logic independent from Next.js, Tauri, Firebase, Redis, and VS
   Code APIs.
4. Add focused unit tests and integration coverage proportional to the risk.
5. Run component checks during development and `pnpm check` before merging.
6. Update the master plan when a phase ships, changes scope, or gains a new
   release gate.
7. Never log secret values, clipboard payloads, device tokens, or signing data.

Generated native directories such as Gradle intermediates and Rust `target`
artifacts are not source. Do not format, review, or commit them.

## Native releases

Native clients use two workflows:

- **Android signed test APK** creates a private, expiring Actions artifact from
  `main` for device and upgrade testing.
- **Release native clients** runs for immutable `keep-v*` tags, builds only
  platforms whose gates are open, verifies signatures, generates checksums and
  provenance, and publishes normalized assets to GitHub Releases.

The download page discovers the latest exact Windows and Android asset names.
See [Native client releases](docs/native-releases.md) before changing versions,
tags, signing configuration, or environment secrets.

## Roadmap

The master plan is the authoritative history and forward roadmap. The main work
still requiring attention is:

1. Windows credential storage, signing, and clean-device release validation.
2. Android Sharesheet, notifications, biometrics, Samsung tablet/DeX testing,
   Quick Settings, and supported Samsung clipboard research.
3. Device presence, rename, revoke, and delivery acknowledgement.
4. Keep Secrets revision history, activity records, comparison UI, and
   hardening.
5. Desktop receive/auto-place, native clipboard signals, signing/notarization,
   and auto-update.
6. Client-side clipboard encryption after a dedicated threat model.
7. Wear OS/Galaxy Watch and iOS/iPadOS companions.

## Documentation

- [Wiki home](docs/wiki-home.md) — compact platform introduction and contributor
  links, ready to publish as the GitHub Wiki landing page.
- [Master plan](docs/master-plan.md) — product decisions, shipped phases, and
  remaining roadmap.
- [Architecture](docs/architecture.md) — dependency direction and system
  boundaries.
- [Native releases](docs/native-releases.md) — signing, testing, and publishing.
- [Wear OS / Galaxy Watch plan](docs/wear-os.md) — proposed watch scope,
  architecture, and delivery phases.
- [Device authorization](docs/device-authorization.md) — browser-based native
  and editor pairing.
- [Redis primary storage](docs/redis-storage.md) — persistence and operational
  model.
- [Firebase constraints](docs/firebase-free-tier.md) — retained Firebase
  limitations.
- [Keep-managed authenticator MFA](docs/custom-totp-mfa.md) — MFA design.

## Security

Report vulnerabilities privately. Do not open a public issue containing secret
values, tokens, clipboard content, signing material, or exploitable account
details. Rotate any credential that may have been exposed.
