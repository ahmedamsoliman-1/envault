# Pull and push secrets

Values are encrypted and decrypted **locally** — plaintext never reaches the
server.

- **Pull** — run **Envault: Pull environment → .env**. The extension unlocks the
  vault (passphrase the first time, silently afterwards), decrypts every value,
  and writes `.env`. If the file exists you can compare before overwriting.
- **Push** — edit `.env`, then run **Envault: Push .env → environment**. You get
  a preview (created / updated / unchanged / invalid) before anything is sent.
  Changes commit with version and idempotency protection; if the environment
  changed on the server you can overwrite or compare & merge.

The unwrapped vault key stays in memory only and auto-locks.
