import { redirect } from "next/navigation";

import { VaultSetup } from "@/components/vault/vault-setup";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <p className="font-mono text-sm text-[var(--accent)]">
        ENVAULT / SECURITY
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Vault setup
      </h1>
      <p className="mb-10 mt-3 max-w-2xl text-[var(--muted)]">
        Encryption and key wrapping happen locally in this browser.
      </p>
      <VaultSetup />
    </main>
  );
}
