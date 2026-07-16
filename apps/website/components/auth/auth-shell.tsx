import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-sm">
        <Link
          className="mb-10 inline-flex items-center gap-2 font-mono text-sm font-medium"
          href="/"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-lg border">
            <LockKeyhole aria-hidden="true" className="size-4" />
          </span>
          ENVAULT
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-center text-sm text-[var(--muted)]">
          {footer}
        </div>
      </section>
    </main>
  );
}
