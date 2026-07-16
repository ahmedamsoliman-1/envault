# Envault

Envault is an API-first, client-side encrypted environment variable management platform.

## Documentation

- [Firebase free-tier constraints](docs/firebase-free-tier.md)
- [Envault-managed authenticator MFA](docs/custom-totp-mfa.md)
- [Redis primary storage](docs/redis-storage.md)
- [Device authorization](docs/device-authorization.md)

## Prerequisites

- Node.js 22.13 or newer; Node.js 24 LTS is recommended
- pnpm 11
- Java 21 for the Firebase Emulator Suite

## Start locally

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The website runs at `http://localhost:3000`. The initial health endpoint is available at
`http://localhost:3000/api/v1/health`.

Next.js and the server packages load the real Firebase configuration from the repository
root `.env`. Keep service account JSON and private keys out of comments and rotate any key
that has been exposed.

## Quality checks

```bash
pnpm check
```

See `Plan.md` for the product specification and `docs/architecture.md` for the evolving
technical architecture.
