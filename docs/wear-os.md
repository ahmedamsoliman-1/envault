# Keep for Wear OS and Samsung Galaxy Watch

Status: planned; no watch application is implemented yet.

## Product position

The watch is a glance-and-action companion for Keep Clipboard, not a miniature
Secrets dashboard and not a background clipboard monitor. Its value is fast,
intentional access to recent safe clipboard items when a phone or computer is
not already in hand.

Initial scope:

- Show a short, sanitized list of recent clipboard previews.
- Open an item and request that it be copied on the paired Android phone.
- Send short dictated or typed text to Keep after explicit confirmation.
- Receive a privacy-safe “new clipboard item” notification.
- Offer a Tile with one or two deliberate actions, such as “Recent” and “Send”.
- Require a fresh unlock or phone confirmation for sensitive actions.

Explicitly out of scope for the first release:

- Keep Secrets project, environment, or plaintext secret browsing.
- Silent clipboard collection from the watch or phone.
- Displaying full sensitive content in notifications, Tiles, complications, or
  always-on surfaces.
- A watch face, custom keyboard, Accessibility workaround, or Samsung-only
  dependency.
- Treating a complication as clipboard history; complications may expose only
  a neutral status or action launcher in a later phase.

## Proposed architecture

Build a native Kotlin module with Compose for Wear OS. The first version should
be **non-standalone** and require the Keep Android companion for authentication
and phone clipboard actions.

```text
Galaxy Watch / Wear OS app
  ├── Compose for Wear OS UI
  ├── local encrypted cache of sanitized metadata
  ├── Data Layer MessageClient for explicit phone commands
  └── DataClient for small, durable paired-device state
            │
            ▼
Keep Android companion
  ├── owns device authorization and token storage
  ├── confirms copy/send operations
  └── calls the existing Keep API
```

Use the Wear OS Data Layer only for local phone/watch coordination. Keep's
existing API remains authoritative for cloud state. Phone and watch packages
must use matching application IDs/signatures where required by the Data Layer.
Do not send clipboard bodies through persistent DataItems; prefer explicit,
short-lived messages and keep only sanitized previews in the watch cache.

A later standalone version may authenticate directly and use Keep's HTTPS API
over Wi-Fi/LTE, but only after device revocation, power behavior, secure token
storage, and watch-native approval UX are designed and tested.

## Delivery phases

### W0 — feasibility and threat model

- Confirm target Galaxy Watch models and Wear OS versions.
- Test phone/watch Data Layer availability, disconnect behavior, and signing.
- Define preview redaction, local retention, lock-screen, and notification rules.
- Decide how the phone confirms “copy this item” and prevents replay.

Exit: a documented protocol and emulator plus real-device proof of concept.

### W1 — paired companion MVP

- Add a dedicated Wear module and round-screen Compose navigation.
- Detect/install/open the Android companion when needed.
- Transfer a scoped watch session from phone to watch.
- Browse sanitized recent items and request phone-side copy.
- Send short explicit text through the phone to Keep.
- Handle disconnected, expired, revoked, and phone-unavailable states.

Exit: signed internal build tested on a Galaxy Watch and paired Samsung phone.

### W2 — wearable surfaces

- Add actionable notifications without clipboard bodies on the lock screen.
- Add a small Tile that launches deliberate actions.
- Prevent duplicate phone/watch notifications through notification bridging
  configuration.
- Add haptics, rotary input, accessibility, font scaling, and battery tests.

Exit: daily-use beta with no sensitive-content leakage on ambient surfaces.

### W3 — security and distribution

- Add watch-local encrypted storage and session revocation.
- Require authentication/confirmation based on item sensitivity and elapsed
  time.
- Add emulator and real-device CI/test matrices.
- Choose Play Store Wear OS distribution or retain a clearly documented private
  sideload flow; direct phone APK distribution does not automatically make a
  correctly targeted watch package.

Exit: independently versioned, signed, upgrade-tested watch release.

### W4 — standalone evaluation

- Evaluate direct Keep API access over watch Wi-Fi/LTE.
- Add QR/short-code browser authorization if a phone is unavailable.
- Measure power, retry, offline cache, and revocation behavior.
- Mark the app standalone only if all core functions genuinely work without the
  phone.

## Acceptance criteria

- No secret or clipboard body appears in logs, analytics, crash reports, Tiles,
  complications, or default lock-screen notifications.
- Every send or copy action is user initiated and visibly confirmed.
- Revoking the watch prevents future API or phone-bridge operations.
- Disconnects and retries cannot duplicate sends or replay copy commands.
- The app remains usable on standard Wear OS hardware; Galaxy Watch testing is
  a priority, not an exclusive dependency.
- Battery and background work follow Wear OS guidance and are measured on real
  hardware before public release.

## References

- [Wear OS Data Layer overview](https://developer.android.com/training/wearables/data/overview)
- [Standalone and non-standalone apps](https://developer.android.com/training/wearables/apps/standalone-apps)
- [Compose for Wear OS setup](https://developer.android.com/training/wearables/get-started/creating)
- [Wear OS notifications](https://developer.android.com/training/wearables/notifications)
- [Wear OS Tiles](https://developer.android.com/training/wearables/tiles)
- [Package and distribute Wear OS apps](https://developer.android.com/training/wearables/packaging)
