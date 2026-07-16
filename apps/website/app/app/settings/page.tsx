import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DeviceSessions } from "@/components/devices/device-sessions";
import { SecuritySettings } from "@/components/settings/security-settings";
import { VaultManager } from "@/components/vault/vault-manager";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      eyebrow="Account"
      title="Settings"
      userEmail={user.email}
      userName={user.displayName}
    >
      <section className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-semibold tracking-[-0.035em]">
          Security settings
        </h2>
        <p className="mb-8 mt-3 text-[var(--muted)]">
          Manage account verification, multi-factor authentication, and vault
          security.
        </p>
        <div className="mb-8 rounded-2xl border bg-[var(--surface)] p-6">
          <h3 className="text-xl font-semibold tracking-[-0.02em]">
            Vault security
          </h3>
          <p className="mb-6 mt-2 text-sm leading-6 text-[var(--muted)]">
            Create, unlock, and manage the locally encrypted vault protecting
            your environment secrets.
          </p>
          <VaultManager />
        </div>
        <SecuritySettings />
        <div className="mt-6">
          <DeviceSessions />
        </div>
      </section>
    </AppShell>
  );
}
