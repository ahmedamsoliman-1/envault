# Keep Platform Wiki

Keep is a secure developer platform for encrypted environment secrets, personal
passwords, and cross-device clipboard synchronization. Every client shares the
same identity, device-authorization flow, versioned API, contracts, and domain
rules.

## What Keep includes

- **Keep Secrets:** encrypted projects, environments, variables, `.env`
  import/export, and VS Code pull/push workflows.
- **Keep Passwords:** a personal, end-to-end-encrypted password manager that
  reuses the vault key (whole-entry client-side encryption). Web, feature-flagged
  — add/edit/copy/search shipped (P0a); browser-CSV import is next. See
  [passwords.md](passwords.md).
- **Keep Clipboard:** short-lived text history and synchronization across the
  web, VS Code, macOS, Windows, and Android/Samsung.
- **Native clients:** a shared Tauri application for desktop and Android, with
  signed releases and platform-specific security gates.

## Current clients

| Client                 | Status        | Main capability                                          |
| ---------------------- | ------------- | -------------------------------------------------------- |
| Web                    | Available     | Secrets workspace and live Clipboard history             |
| VS Code                | Available     | `.env` workflows plus send/insert Clipboard actions      |
| macOS                  | Available     | Automatic Clipboard sending with likely-secret filtering |
| Android/Samsung        | Public beta   | Manual send, history, and tap-to-copy                    |
| Windows                | Release gated | Desktop Clipboard companion awaiting signing hardening   |
| Galaxy Watch / Wear OS | Planned       | Safe previews and explicit phone-assisted actions        |

Android intentionally does not promise silent background clipboard monitoring.
Sharesheet support, notifications, biometrics, DeX improvements, and supported
Samsung integrations remain planned enhancements.

## Start developing

```bash
cp .env.example .env
pnpm install
pnpm dev
pnpm check
```

Use pnpm filters for individual applications:

```bash
pnpm --filter @keephq/website dev
pnpm --filter keep-vscode build
pnpm --filter keep-desktop app:dev
```

## Important links

- [Repository README](../README.md)
- [Master plan](master-plan.md)
- [Architecture](architecture.md)
- [Native release process](native-releases.md)
- [Galaxy Watch / Wear OS plan](wear-os.md)
- [Device authorization](device-authorization.md)
- [Redis storage](redis-storage.md)

## Roadmap focus

1. Complete Windows credential storage, signing, and release validation.
2. Improve Android/Samsung with Sharesheet, notifications, biometrics, and DeX.
3. Add device presence, rename, revoke, and delivery acknowledgement.
4. Return to Secrets revision history, activity, comparison UI, and hardening.
5. Continue native receive, signing/notarization, updater, and clipboard
   encryption work.
6. Begin the staged Wear OS companion only after its Android and device-security
   foundations are stable.

Never publish secret values, clipboard payloads, device tokens, keystores, or
signing credentials in issues, logs, screenshots, or Wiki pages.
