"use client";

import {
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { EnvaultLogo } from "@/components/brand/envault-logo";

const links = [
  { href: "/app/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/vault", label: "Vault security", icon: ShieldCheck },
  { href: "/app/profile", label: "Profile", icon: UserRound },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function MobileNavigation({
  userEmail,
  userName,
}: {
  userEmail: string | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="flex w-full items-center justify-between lg:hidden">
        <Link href="/app/dashboard">
          <EnvaultLogo />
        </Link>
        <button
          aria-expanded={open}
          aria-label="Open navigation"
          className="flex size-10 items-center justify-center rounded-xl bg-[var(--foreground)] text-[var(--background)] shadow-md shadow-black/10 ring-1 ring-black/5 hover:scale-[1.03] hover:shadow-lg active:scale-95 dark:shadow-black/30"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Menu className="size-5 stroke-[2.25]" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col border-l bg-[var(--sidebar)] p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-2">
              <EnvaultLogo />
              <button
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-7 space-y-1">
              {links.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/app/dashboard" &&
                    pathname.startsWith(`${item.href}/`));
                return (
                  <Link
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                      active
                        ? "bg-indigo-500/10 text-indigo-600"
                        : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    }`}
                    href={item.href}
                    key={item.href}
                  >
                    <item.icon className="size-4.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto rounded-2xl border bg-[var(--surface)] p-3">
              <Link
                className="flex items-center gap-3 rounded-xl p-2"
                href="/app/profile"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-sm font-semibold text-indigo-600">
                  {(userName ?? userEmail ?? "E").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {userName ?? "Envault user"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {userEmail ?? "Individual workspace"}
                  </span>
                </span>
              </Link>
              <div className="mt-2 border-t pt-2">
                <LogoutButton variant="sidebar" />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
