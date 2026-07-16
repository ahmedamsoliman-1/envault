# Device authorization

Envault external clients use a browser-approved authorization flow rather than
collecting Firebase passwords, MFA codes, vault passphrases, or browser
cookies.

## Flow

1. The client generates a high-entropy PKCE verifier and SHA-256 challenge.
2. It creates a short-lived device authorization.
3. Envault returns a verification URL and human-readable code.
4. The browser signs the user in and displays the requested scopes.
5. The user explicitly approves the device.
6. The client exchanges the verifier once for a random device access token.
7. Only a SHA-256 token hash is indexed in Redis.
8. The raw token is stored in VS Code SecretStorage.

Authorizations expire after `DEVICE_AUTHORIZATION_TTL_SECONDS`. Device sessions
expire after `DEVICE_SESSION_MAX_AGE_SECONDS` and can be revoked immediately
from Settings.

## Redis keys

- `envault:v1:device-authorization:{authorizationId}`
- `envault:v1:device-user-code:{userCode}`
- `envault:v1:device-session:{sessionId}`
- `envault:v1:device-token:{tokenHash}`
- `envault:v1:user:{userId}:device-sessions`

## Initial scopes

- `projects:read`
- `environments:read`
- `variables:read`
- `variables:write`

The first extension milestone enables bearer access only for project,
environment, and encrypted-variable discovery. Write and vault-key workflows
remain disabled until their device-specific encryption design is completed.
