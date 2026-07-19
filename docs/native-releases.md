# Native client releases

Keep publishes native installers from `.github/workflows/release-native.yml`.
Release builds run on the target operating system, produce deterministic asset
names, generate SHA-256 checksums and GitHub build-provenance attestations, and
publish from an existing `keep-v*` Git tag.

## Release assets

- `Keep-Clipboard-macOS-arm64.dmg`
- `Keep-Clipboard-Windows-x64-Setup.exe`
- `Keep-Clipboard-Windows-x64.msi`
- `Keep-Clipboard-Android-universal.apk`
- `SHA256SUMS.txt`

The Android public-beta release gate requires signed upgrade testing, reliable
pairing/sign-out, app-private session storage with Android Keystore preferred,
and honest product limitations on the download page. Sharesheet, biometrics,
notifications, Quick Settings, Samsung clipboard research, and additional DeX
polish may ship in later beta updates.

Before that public gate, `.github/workflows/android-test.yml` can be run
manually from `main`. It creates a signed universal APK as a private GitHub
Actions artifact with a 14-day retention period. It does not create a GitHub
Release and does not expose the APK on `/download`.

## GitHub environment

Create a protected GitHub environment named `native-release`. Require reviewer
approval and restrict deployment to protected `keep-v*` tags. Configure:

| Kind                 | Name                            | Purpose                                                                                |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| Environment variable | `KEEP_WINDOWS_RELEASE_APPROVED` | Must equal `true` after Credential Manager integration and Windows device testing pass |
| Environment secret   | `WINDOWS_CERTIFICATE_BASE64`    | Base64-encoded Authenticode PFX                                                        |
| Environment secret   | `WINDOWS_CERTIFICATE_PASSWORD`  | PFX password                                                                           |

Do not set the Windows approval variable early. Android is gated by the
protected tag, the `native-release` environment approval, and the required
signing secrets rather than a duplicate boolean flag.

## Publishing

1. Update the version in `apps/keep-desktop/package.json`,
   `apps/keep-desktop/src-tauri/Cargo.toml`, and
   `apps/keep-desktop/src-tauri/tauri.conf.json`.
2. Merge a green CI build.
3. Create and push a protected tag such as `keep-v0.2.0`. macOS and Android
   publish together; Windows remains independently gated until its signing and
   device-testing requirements pass.
4. Approve the `native-release` environment deployment.
5. Verify the release checksums, provenance and installers on clean devices.
6. Confirm `/download` resolves the latest Windows and Android installers.

The workflow can also be started manually for an existing `keep-v*` tag. It
never creates a release from an arbitrary branch or untagged commit.

## Android private testing

The protected `native-release` environment must contain these secrets:

| Name                        | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Base64-encoded Android release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                       |
| `ANDROID_KEY_ALIAS`         | Release key alias                       |
| `ANDROID_KEY_PASSWORD`      | Private-key password                    |

Run **Android signed test APK** from the repository's Actions page, approve the
`native-release` environment if prompted, then download the artifact from the
completed workflow run. The workflow verifies the APK signature and includes a
SHA-256 checksum. Keep the same keystore permanently: Android only accepts an
update when it is signed with the same key as the installed app.

The current distribution plan is direct APK download, not Google Play. After
the Android release gate passes, approve the protected `native-release`
deployment. The tagged workflow publishes
`Keep-Clipboard-Android-universal.apk`, and the website discovers that exact
asset from the latest GitHub Release automatically.

## VS Code extension releases

The VS Code extension has a **separate** track from the native installers, since
it publishes to the VS Code Marketplace rather than GitHub Releases and keeps its
own version in `apps/vscode-extension/package.json`.

`.github/workflows/release-vscode.yml` verifies (lint/typecheck/test/build),
packages, and publishes the extension. It triggers on a manual `workflow_dispatch`
(recommended) or a `vscode-v*` tag. Because Marketplace versions are immutable,
the workflow auto-increments the patch version until it finds a free one,
publishes it, then commits the `package.json` bump back to the default branch —
so each run just publishes the next patch. Channel follows the odd/even-minor
convention in `apps/vscode-extension/scripts/release.sh` (odd minor → pre-release,
even → stable); CI only moves the patch, and `workflow_dispatch` can override the
channel. It needs `contents: write` for the commit-back; if the default branch is
protected the publish still succeeds and the bump is left to a manual edit.

Create a `vscode-release` GitHub environment with:

| Kind               | Name       | Purpose                                                            |
| ------------------ | ---------- | ------------------------------------------------------------------ |
| Environment secret | `VSCE_PAT` | Azure DevOps PAT for the `keep` publisher, **Marketplace: Manage** |
| Environment secret | `OVSX_PAT` | _(optional)_ Open VSX token to mirror the same build               |

Because `vscode-v*` and `keep-v*` use different tag prefixes, the extension and
native release workflows never trigger each other.

## Android beta scope and follow-ups

The direct-download beta intentionally supports manual text sending, clipboard
history, and tap-to-copy. Android restricts background clipboard reads, so the
app does not claim macOS-style automatic capture.

Future Android/Samsung work is tracked in this order:

1. Android Sharesheet target for sending selected text directly to Keep.
2. Notifications and foreground/background receive behavior.
3. Biometric app lock and stronger Keystore compatibility diagnostics.
4. Samsung tablet/DeX layout testing and an optional Quick Settings tile.
5. Investigate Samsung clipboard integration using supported public APIs only;
   Keep will not use Accessibility scraping or depend exclusively on Samsung.
