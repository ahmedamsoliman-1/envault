import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { VaultStatusCard } from "@/components/vault/vault-status-card";
import { isEmailVerificationRequired } from "@/lib/features";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isEmailVerificationRequired() && !user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between border-b pb-6">
        <div>
          <p className="font-mono text-sm text-[var(--accent)]">ENVAULT</p>
          <h1 className="mt-2 text-2xl font-semibold">Dashboard</h1>
        </div>
        <LogoutButton />
      </header>
      <section className="py-16">
        <p className="text-sm text-[var(--muted)]">
          Authenticated as {user.email}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Your encrypted workspace starts here.
        </h2>
        <p className="mt-4 max-w-xl leading-7 text-[var(--muted)]">
          Authentication is active. Create the client-side encrypted vault
          before adding projects and environment variables.
        </p>
        <VaultStatusCard />
      </section>
    </main>
  );
}
