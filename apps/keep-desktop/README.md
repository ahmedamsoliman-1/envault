# Keep Clipboard (macOS/Windows desktop agent)

A menu-bar app that watches this machine's clipboard and **automatically** sends
whatever you copy to Keep, where it appears live in the web UI and on your other
paired devices. Built with [Tauri](https://tauri.app) (thin Rust shell + a small
webview that reuses `@keephq/api-client` and `@keephq/domain`).

> It is a **client**, not a server. There is no "desktop server" — the app talks
> to the already-deployed Keep backend (`keep.aamsdn.space`). See
> [Architecture](#architecture).

## What it does

- Polls the OS clipboard ~1×/second; on a new copy it sends the text to
  `POST /api/v1/clipboard/items` (origin `macos`), exactly like the web and VS
  Code clients.
- **Secret-guard:** content that `detectSensitivity()` classifies as a secret
  (private keys, tokens, `AWS_SECRET_ACCESS_KEY`, …) is skipped, silently. No
  prompts.
- **Pause** toggle for when you're about to copy sensitive junk.
- **Start at login** toggle (registers a macOS LaunchAgent) so it's always on.
- Pairs as a device via the same browser-approval flow the VS Code extension
  uses; the token is stored via the Tauri store.

## Prerequisites

| To…                   | You need                                                                   |
| --------------------- | -------------------------------------------------------------------------- |
| **Build** the app     | Rust ≥ 1.88 (`brew install rust`), Node 24, pnpm, Xcode Command Line Tools |
| **Run** the built app | **Nothing.** The `.app` is a native binary — no Rust, no Node.             |

The second point matters: to run it on another Mac you copy over the built
`.app`/`.dmg` and open it. Rust is a *build-time* dependency only.

## Develop

From the repo root:

```bash
nvm use 24
pnpm install
pnpm --filter keep-desktop app:dev     # = tauri dev
```

`tauri dev` compiles the Rust shell, launches the app with the webview served by
Vite (hot-reload for the UI), and keeps a terminal attached for logs. This is
the loop for changing the app.

- Change the target server in `src/main.ts` (`SERVER`) — and keep the matching
  host in `src-tauri/capabilities/default.json` under `http:default` `allow`,
  or requests will be blocked by Tauri's HTTP scope.

## Build a distributable

```bash
pnpm --filter keep-desktop app:build   # = tauri build
```

Outputs to `src-tauri/target/release/bundle/`:

- `macos/Keep Clipboard.app` — the app bundle
- `dmg/Keep Clipboard_<version>_aarch64.dmg` — drag-to-install image

The build is **unsigned** for now, so the first launch needs a right-click →
**Open** (or System Settings → Privacy & Security → Open Anyway) to get past
Gatekeeper. Code signing + notarization is a later hardening step.

## Install & run always-on

1. Build (above), or copy the `.dmg` to the target Mac.
2. Drag **Keep Clipboard.app** to `/Applications` and open it (right-click →
   Open the first time).
3. Click the menu-bar icon → **Connect this Mac** → approve in the browser.
4. Toggle **Start at login**.

From then on it launches into the menu bar at every login and syncs
automatically. No terminal, no `pnpm`.

## Architecture

```
                       ┌─────────────────────────────┐
   THIS MAC            │        Keep backend         │        OTHER DEVICES
                       │   (keep.aamsdn.space)        │
 ┌───────────────┐     │   Next.js API + Redis        │     ┌──────────────┐
 │ menu-bar app  │ ──► │  POST /clipboard/items       │ ──► │ web UI (live)│
 │ (this crate)  │     │  → Redis Stream → SSE fanout │     │ VS Code      │
 └───────────────┘     │  ALWAYS-ON / containerizable │     │ future phone │
   native client       └─────────────────────────────┘        native clients
```

- **Server** — one always-on instance in the cloud (already deployed). This is
  the piece that *could* run in Docker/containers long-term.
- **Clients** — one per device (web tab, VS Code, this Mac app, future mobile).
  Native, per-machine.

### Why this can't run in Docker

A Docker container is a headless Linux sandbox with no GUI and **no access to
the host's clipboard**. This app's whole job is reading the macOS pasteboard and
living in the menu bar — both are host-OS/GUI features a container cannot reach.
The *server* is the containerizable half; the desktop agent must run natively on
each machine whose clipboard you want to sync.

## Status / not yet done

- Token is in the Tauri store; **Keychain** storage is the next hardening step.
- Clipboard is read via `tauri-plugin-clipboard-manager` (text polling); native
  `changeCount` + concealed-type detection (to skip password-manager copies at
  the OS level, not just via regex) is a follow-up.
- **Receive** (show items from other devices, optional auto-place into the local
  clipboard) is not built yet — send-only for now.
