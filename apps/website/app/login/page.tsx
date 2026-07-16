import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requestedDestination = (await searchParams).next;
  const destination =
    requestedDestination?.startsWith("/") &&
    !requestedDestination.startsWith("//")
      ? requestedDestination
      : "/app/dashboard";
  return (
    <AuthShell
      description="Sign in to unlock access to your encrypted environments."
      footer={
        <>
          New to Envault?{" "}
          <Link
            className="font-medium text-indigo-600 hover:text-indigo-500"
            href="/register"
          >
            Create an account
          </Link>
        </>
      }
      title="Welcome back"
    >
      <AuthForm destination={destination} mode="login" />
      <Link
        className="mt-4 block text-right text-xs font-medium text-indigo-600 hover:text-indigo-500"
        href="/forgot-password"
      >
        Forgot password?
      </Link>
    </AuthShell>
  );
}
