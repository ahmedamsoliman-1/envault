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

The Android release job remains blocked until the native Android shell, secure
storage, biometrics, Sharesheet and notification work passes its release gate.
Until then, keep `KEEP_ANDROID_RELEASE_APPROVED` unset or set to `false`.

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
| Environment variable | `KEEP_ANDROID_RELEASE_APPROVED` | Must equal `true` only after Android feature and device testing pass                   |

Do not set either approval variable early. The workflow treats them as security
gates and refuses to publish the associated installer before its release gate.

## Publishing

1. Update the version in `apps/keep-desktop/package.json`,
   `apps/keep-desktop/src-tauri/Cargo.toml`, and
   `apps/keep-desktop/src-tauri/tauri.conf.json`.
2. Merge a green CI build.
3. Create and push a protected tag such as `keep-v0.2.0`.
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
the Android release gate passes, set `KEEP_ANDROID_RELEASE_APPROVED=true`. The
tagged workflow publishes `Keep-Clipboard-Android-universal.apk`, and the
website discovers that exact asset from the latest GitHub Release automatically.
