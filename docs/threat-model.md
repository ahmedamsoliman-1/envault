# Threat model

Envault is designed to limit damage from database disclosure, server compromise,
cross-account authorization bugs, stolen device credentials, request replay, stale
concurrent writes, and accidental logging or persistence of plaintext secrets.

The server cannot decrypt vault contents because unwrapped vault keys and plaintext values
remain in client memory only. This does not protect secrets from a compromised browser,
extension runtime, operating system, or malicious code executing while the vault is
unlocked.

Detailed abuse cases and mitigations will be expanded alongside each delivery phase.
