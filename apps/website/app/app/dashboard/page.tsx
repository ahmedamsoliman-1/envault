import { redirect } from "next/navigation";
import { RedisProjectRepository } from "@envault/redis/repositories";

import { WorkspaceNavigator } from "@/components/dashboard/workspace-navigator";
import { AppShell } from "@/components/layout/app-shell";
import { VaultStatusCard } from "@/components/vault/vault-status-card";
import { DeviceRepository } from "@/lib/device-repository";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { isEmailVerificationRequired } from "@/lib/features";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isEmailVerificationRequired() && !user.emailVerified) {
    redirect("/verify-email");
  }
  const redis = getAdminFirestore();
  const [overview, deviceSessions] = await Promise.all([
    new RedisProjectRepository(redis).overview(user.id),
    new DeviceRepository(redis).listSessions(user.id),
  ]);

  return (
    <AppShell
      eyebrow="Workspace"
      title="Overview"
      userEmail={user.email}
      userName={user.displayName}
    >
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-sm text-[var(--muted)]">Welcome back</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-[-0.035em]">
              Your environments, organized and protected.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">
              Jump directly into any project environment while Envault keeps
              sensitive values encrypted on the client.
            </p>
            <VaultStatusCard />
            <div className="mt-8">
              <WorkspaceNavigator overview={overview} />
            </div>
          </div>
          <aside className="h-fit rounded-2xl border bg-[var(--surface)] p-6 xl:sticky xl:top-24">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Workspace summary
            </p>
            <div className="mt-6 divide-y">
              {[
                { label: "Projects", value: overview.projectCount },
                { label: "Environments", value: overview.environmentCount },
                { label: "Variables", value: overview.variableCount },
                { label: "Authorized devices", value: deviceSessions.length },
              ].map(({ label, value }) => (
                <div
                  className="flex items-center justify-between py-4"
                  key={label}
                >
                  <span className="text-sm text-[var(--muted)]">{label}</span>
                  <span className="font-mono text-sm font-medium">
                    {value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
