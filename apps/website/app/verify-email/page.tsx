import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerificationPanel } from "@/components/auth/verification-panel";
import { isEmailVerificationRequired } from "@/lib/features";

export default function VerifyEmailPage() {
  if (!isEmailVerificationRequired()) {
    redirect("/app/dashboard");
  }

  return (
    <AuthShell
      description="Verify your email before creating or accessing encrypted vault data."
      footer="You can change accounts by signing out below."
      title="Check your inbox"
    >
      <VerificationPanel />
    </AuthShell>
  );
}
