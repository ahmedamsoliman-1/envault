# Architecture

Keep is an API-first platform with multiple clients and two bounded product
areas: encrypted environment secrets and cross-device clipboard synchronization.
The website is both a product surface and the BFF for the same versioned API
used by VS Code and native clients.

```text
Web / VS Code / macOS / Windows / Android / future Wear OS and iOS
                            │
                            ▼
              typed API client + contracts
                            │
                            ▼
                 Next.js /api/v1 route handlers
           auth · scopes · parsing · validation · mapping
                            │
                            ▼
                  application services / use cases
                            │
                            ▼
                         domain rules
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
       Redis repositories        Firebase integrations
       and event streams          and authentication
```

Route handlers own transport concerns only: session or device authentication,
scope enforcement, request parsing, schema validation, application-service
invocation, and response mapping. Domain rules do not live in React components,
route handlers, VS Code commands, Tauri bridges, or repositories.

## Product security boundaries

Keep Secrets encrypts plaintext on trusted clients. The API and primary storage
receive versioned ciphertext and encryption metadata, not secret plaintext.
Device-wrapped unlock material lets approved clients participate without asking
users to type Firebase passwords into editor or native surfaces.

Keep Clipboard currently applies authorization scopes, sensitivity detection,
safe previews, deduplication, bounded retention, and payload-safe logging.
Clipboard content is not yet client-side encrypted; that work requires the
Phase 18 threat model before protocol changes are made.

## Package direction

- `domain` has no infrastructure dependencies.
- `application` depends on domain abstractions.
- `api-contract` contains shared Zod transport schemas.
- `api-client` consumes contracts without depending on Next.js.
- `crypto` defines a runtime-independent protocol with browser and Node
  adapters.
- `redis` implements primary repositories, atomic state transitions, and
  clipboard event streams.
- `firebase` contains authentication and retained Firebase integrations.
- `website` composes application and infrastructure at the BFF boundary.
- VS Code and native apps consume shared packages; they do not import website
  internals or private persistence behavior.

Dependencies flow inward toward contracts and domain rules. Infrastructure and
framework packages must not leak into the domain layer.

## Client behavior

- Web uses browser sessions and can subscribe to bounded SSE clipboard streams.
- VS Code uses device authorization and VS Code SecretStorage.
- macOS and Windows share a Tauri desktop client but keep platform-specific
  clipboard, startup, tray, credential, signing, and testing behavior.
- Android shares the Tauri UI but uses explicit send/history/copy behavior
  because background clipboard reads are restricted.
- Wear OS is planned as a native paired companion; phone/watch coordination
  uses the Wear OS Data Layer while Keep's API remains authoritative.

## Compatibility

The Envault-to-Keep rename did not rewrite persisted cryptographic or Redis
namespaces. Existing `envault:*` identifiers remain intentional compatibility
contracts unless a separately versioned migration replaces them.
