import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { PasswordWorkspace } from "@/components/passwords/password-workspace";
import {
  isEmailVerificationRequired,
  isPasswordsEnabled,
} from "@/lib/features";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PasswordsPage() {
  if (!isPasswordsEnabled()) notFound();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (isEmailVerificationRequired() && !user.emailVerified) {
    redirect("/verify-email");
  }

  return (
    <AppShell
      eyebrow="Workspace"
      title="Passwords"
      userEmail={user.email}
      userName={user.displayName}
    >
      <section className="mx-auto max-w-5xl">
        <PasswordWorkspace />
      </section>
    </AppShell>
  );
}
