import { notFound, redirect } from "next/navigation";

import { ClipboardWorkspace } from "@/components/clipboard/clipboard-workspace";
import { AppShell } from "@/components/layout/app-shell";
import {
  isClipboardEnabled,
  isEmailVerificationRequired,
} from "@/lib/features";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClipboardPage() {
  if (!isClipboardEnabled()) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isEmailVerificationRequired() && !user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <AppShell
      eyebrow="Workspace"
      title="Clipboard"
      userEmail={user.email}
      userName={user.displayName}
    >
      <section className="mx-auto max-w-7xl">
        <ClipboardWorkspace />
      </section>
    </AppShell>
  );
}
