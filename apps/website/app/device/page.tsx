import { redirect } from "next/navigation";

import { DeviceApproval } from "@/components/devices/device-approval";
import { AppShell } from "@/components/layout/app-shell";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { DeviceRepository } from "@/lib/device-repository";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{ authorizationId?: string; code?: string }>;
}) {
  const user = await getSessionUser();
  const { authorizationId, code } = await searchParams;
  if (!authorizationId || !code) redirect("/app/settings");
  if (!user)
    redirect(
      `/login?next=${encodeURIComponent(
        `/device?authorizationId=${authorizationId}&code=${code}`,
      )}`,
    );
  const authorization = await new DeviceRepository(
    getAdminFirestore(),
  ).findAuthorization(authorizationId);
  if (!authorization || authorization.userCode !== code.toUpperCase())
    redirect("/app/settings");

  return (
    <AppShell
      eyebrow="Device authorization"
      title="Approve device"
      userEmail={user.email}
      userName={user.displayName}
    >
      <DeviceApproval
        authorizationId={authorization.id}
        clientName={authorization.clientName}
        deviceName={authorization.deviceName}
        scopes={authorization.scopes}
        userCode={authorization.userCode}
      />
    </AppShell>
  );
}
