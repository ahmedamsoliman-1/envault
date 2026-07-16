# Envault for VS Code

Initial Phase 8 extension scaffold.

Commands:

- `Envault: Sign in`
- `Envault: Sign out`
- `Envault: Show connection status`

Authentication uses browser-approved device authorization with PKCE. The
revocable device token is stored only in VS Code SecretStorage.

Build with:

```bash
pnpm --filter @envault/vscode-extension build
```
