"use client";

import { EnvaultClient } from "@envault/api-client";
import { LockKeyhole, LockOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const client = new EnvaultClient({ baseUrl: "" });

export function VaultStatusCard() {
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    void client.vault
      .get()
      .then((status) => setExists(status.exists))
      .catch(() => setExists(false));
  }, []);

  return (
    <article className="mt-10 max-w-xl rounded-xl border p-6">
      {exists ? (
        <LockOpen className="size-5 text-[var(--accent)]" />
      ) : (
        <LockKeyhole className="size-5 text-[var(--accent)]" />
      )}
      <h3 className="mt-4 text-lg font-semibold">
        {exists === null
          ? "Checking vault status…"
          : exists
            ? "Vault created"
            : "Create your encrypted vault"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {exists
          ? "Your wrapped vault keys are stored. Unlocking will be added in the next step."
          : "Generate your client-side vault key, passphrase wrapping, and recovery key."}
      </p>
      {!exists && exists !== null ? (
        <Link
          className="mt-5 inline-flex rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)]"
          href="/app/vault"
        >
          Set up vault
        </Link>
      ) : null}
    </article>
  );
}
