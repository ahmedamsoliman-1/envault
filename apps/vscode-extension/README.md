# Envault for VS Code

Envault connects VS Code to your encrypted Envault workspace using a
browser-approved device authorization flow.

## Features

- Sign in without entering your Envault password inside VS Code.
- Store the revocable device credential in VS Code SecretStorage.
- Show the current connection status.
- Select an Envault project and environment.

This is an early pre-release. Pulling and pushing environment files will be
added in the next extension milestones.

## Commands

- `Envault: Sign in`
- `Envault: Sign out`
- `Envault: Show connection status`
- `Envault: Select environment`

Open the Command Palette with `Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on
Windows and Linux, then search for `Envault`.

## Server configuration

Set `envault.serverUrl` to the URL of the Envault web application you want the
extension to use. It defaults to the hosted Envault application:

```text
https://env.aamsdn.space
```

For local development:

```json
{
  "envault.serverUrl": "http://localhost:3000"
}
```

## Security

Authentication uses browser-approved device authorization with PKCE. The
revocable access token is stored only in VS Code SecretStorage. You can revoke
authorized editor devices from Envault security settings.

## Development

Use Node.js 22.13 or newer, install the workspace dependencies, and build:

```bash
pnpm install
pnpm --filter ./apps/vscode-extension build
```

Package a locally installable VSIX:

```bash
pnpm --filter ./apps/vscode-extension package:vsix
```
