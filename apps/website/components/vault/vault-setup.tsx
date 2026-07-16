"use client";

import { EnvaultClient } from "@envault/api-client";
import type { VaultKeyMaterialV1 } from "@envault/crypto";
import { createVaultKeyMaterial } from "@envault/crypto";
import { getBrowserCryptoProvider } from "@envault/crypto/browser";
import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { setActiveVaultKey } from "@/lib/vault-key-store";

const client = new EnvaultClient({ baseUrl: "" });

interface PendingVault {
  vaultId: string;
  material: VaultKeyMaterialV1;
  recoveryKey: string;
  vaultKey: Uint8Array;
}

export function VaultSetup() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pendingVault, setPendingVault] = useState<PendingVault | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepareVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (passphrase !== confirmation) {
      setError("The passphrases do not match.");
      return;
    }

    setPending(true);
    try {
      const vaultId = crypto.randomUUID();
      const settings = await client.vault.getSettings();
      const generated = await createVaultKeyMaterial(
        getBrowserCryptoProvider(),
        vaultId,
        passphrase,
        settings.pbkdf2Iterations,
      );
      setPendingVault({ vaultId, ...generated });
      setPassphrase("");
      setConfirmation("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Vault setup failed.",
      );
    } finally {
      setPending(false);
    }
  }

  async function createVault() {
    if (!pendingVault || !saved) return;
    setPending(true);
    setError(null);
    try {
      await client.vault.create({
        vaultId: pendingVault.vaultId,
        ...pendingVault.material,
        autoLockMinutes: 15,
      });
      setActiveVaultKey(pendingVault.vaultKey);
      pendingVault.vaultKey.fill(0);
      setPendingVault(null);
      router.push("/app/dashboard");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Vault setup failed.",
      );
    } finally {
      setPending(false);
    }
  }

  if (pendingVault) {
    return (
      <section className="max-w-xl rounded-xl border p-6">
        <ShieldCheck className="size-6 text-[var(--accent)]" />
        <h2 className="mt-5 text-2xl font-semibold">Save your recovery key</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          This key is displayed once. Envault administrators cannot recover your
          vault if you lose both this key and your vault passphrase.
        </p>
        <div className="mt-6 flex items-center gap-3 rounded-lg border bg-black/5 p-4 dark:bg-white/5">
          <code className="min-w-0 flex-1 break-all text-sm">
            {pendingVault.recoveryKey}
          </code>
          <button
            aria-label="Copy recovery key"
            className="rounded-md border p-2"
            onClick={() => {
              void navigator.clipboard.writeText(pendingVault.recoveryKey);
              setCopied(true);
            }}
            type="button"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
        <label className="mt-6 flex items-start gap-3 text-sm">
          <input
            checked={saved}
            className="mt-0.5"
            onChange={(event) => setSaved(event.target.checked)}
            type="checkbox"
          />
          I saved the recovery key in a secure location and understand it cannot
          be shown again.
        </label>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button
          className="mt-6 w-full rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] disabled:opacity-50"
          disabled={!saved || pending}
          onClick={() => {
            void createVault();
          }}
          type="button"
        >
          {pending ? "Creating encrypted vault…" : "Create encrypted vault"}
        </button>
      </section>
    );
  }

  return (
    <form
      className="max-w-xl rounded-xl border p-6"
      onSubmit={(event) => void prepareVault(event)}
    >
      <KeyRound className="size-6 text-[var(--accent)]" />
      <h2 className="mt-5 text-2xl font-semibold">
        Create your encrypted vault
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Choose a separate vault passphrase. It is never sent to Envault and
        cannot be reset using your account password.
      </p>
      <label className="mt-6 block text-sm font-medium">
        Vault passphrase
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]"
          minLength={12}
          onChange={(event) => setPassphrase(event.target.value)}
          required
          type="password"
          value={passphrase}
        />
      </label>
      <label className="mt-5 block text-sm font-medium">
        Confirm vault passphrase
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]"
          minLength={12}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </label>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <button
        className="mt-6 w-full rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Generating keys…" : "Continue"}
      </button>
    </form>
  );
}
