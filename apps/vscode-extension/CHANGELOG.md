# Change Log

## 0.3.1

- Unlock the vault locally with a passphrase or recovery key; the unwrapped key
  is held in memory only and auto-locks.
- Silent unlock on later sessions using a device-wrapped key (revocable from the
  web); the passphrase is entered at most once per device.
- Pull an environment into `.env` with an overwrite guard and diff.
- Push `.env` back with a change preview, local encryption, expected-version and
  idempotency protection, and overwrite / compare-&-merge on conflicts.
- Environments view in the Activity Bar with per-environment pull/push.
- Status-bar item showing connection, lock and selected-environment state.
- Per-workspace-folder environment binding.

## 0.1.0

- Add browser-approved device authorization with PKCE.
- Store device credentials in VS Code SecretStorage.
- Add connection status and sign-out commands.
- Add project and environment selection.
