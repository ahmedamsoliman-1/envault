# Architecture

Envault is an API-first system. The website is one client of the same versioned API that
future VS Code, CLI, and desktop clients will use.

```text
Client
  -> typed API client
  -> Next.js /api/v1 route handler
  -> application service
  -> domain model
  -> Firestore repository
  -> Cloud Firestore
```

Route handlers own transport concerns only: session authentication, request parsing,
schema validation, application-service invocation, and response mapping. Domain rules do
not live in React components, route handlers, or repositories.

Secret values are encrypted on the client. The API and Firestore receive only versioned
ciphertext and encryption metadata.

## Package direction

- `domain` has no infrastructure dependencies.
- `application` depends on domain abstractions.
- `api-contract` contains shared Zod transport schemas.
- `api-client` consumes API contracts without depending on Next.js.
- `crypto` defines a runtime-independent protocol with browser and Node adapters.
- `firebase` implements server-side repositories and Firebase initialization.
- `website` composes the application and infrastructure at its boundaries.
