import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginPage() {
  return (
    <AuthShell
      description="Sign in to unlock access to your encrypted environments."
      footer={
        <>
          New to Envault?{" "}
          <Link className="text-[var(--foreground)] underline" href="/register">
            Create an account
          </Link>
        </>
      }
      title="Welcome back"
    >
      <AuthForm mode="login" />
      <Link
        className="mt-4 block text-right text-sm underline"
        href="/forgot-password"
      >
        Forgot password?
      </Link>
    </AuthShell>
  );
}
