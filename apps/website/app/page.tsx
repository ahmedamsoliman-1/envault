import { LockKeyhole } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-24">
      <section className="max-w-2xl">
        <div className="mb-8 inline-flex size-10 items-center justify-center rounded-lg border">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <p className="mb-3 font-mono text-sm text-[var(--accent)]">ENVAULT</p>
        <h1 className="m-0 text-5xl font-semibold tracking-tight">
          Your environments, organized and protected.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
          A client-side encrypted workspace for managing environment variables
          across projects, environments, and future developer tools.
        </p>
        <div className="mt-10 flex items-center gap-3 text-sm">
          <Link
            className="rounded-lg bg-[var(--foreground)] px-4 py-2.5 font-medium text-[var(--background)]"
            href="/register"
          >
            Create account
          </Link>
          <Link
            className="rounded-lg border px-4 py-2.5 font-medium"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
