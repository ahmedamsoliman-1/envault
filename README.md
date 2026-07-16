# Envault

Envault is an API-first, client-side encrypted environment variable management platform.

## Prerequisites

- Node.js 20.20 or newer
- pnpm 11
- Java 21 for the Firebase Emulator Suite

## Start locally

```bash
cp apps/website/.env.example apps/website/.env.local
pnpm install
pnpm dev
```

The website runs at `http://localhost:3000`. The initial health endpoint is available at
`http://localhost:3000/api/v1/health`.

Next.js loads the real Firebase configuration from `apps/website/.env.local`. Keep service
account JSON and private keys out of comments and rotate any key that has been exposed.

## Quality checks

```bash
pnpm check
```

See `Plan.md` for the product specification and `docs/architecture.md` for the evolving
technical architecture.
