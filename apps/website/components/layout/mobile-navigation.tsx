"use client";

import {
  ClipboardList,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { KeepLogo } from "@/components/brand/keep-logo";
import { VaultQuickControl } from "@/components/vault/vault-quick-control";
import { isClipboardEnabled, isPasswordsEnabled } from "@/lib/features";

const links = [
  { href: "/app/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  ...(isPasswordsEnabled()
    ? [{ href: "/app/passwords", label: "Passwords", icon: KeyRound }]
    : []),
  ...(isClipboardEnabled()
    ? [{ href: "/app/clipboard", label: "Clipboard", icon: ClipboardList }]
    : []),
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="flex w-full items-center justify-between lg:hidden">
        <Link href="/app/dashboard">
          <KeepLogo />
        </Link>
        <button
          aria-expanded={open}
          aria-label="Open navigation"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 ring-2 ring-indigo-600/10 hover:scale-[1.03] hover:bg-indigo-500 hover:shadow-xl active:scale-95"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Menu className="size-5.5 stroke-[2.5]" />
        </button>
      </div>

      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[100] lg:hidden">
              <button
                aria-label="Close navigation"
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                type="button"
              />
              <aside
                className="absolute inset-y-0 right-0 isolate z-10 flex w-[min(88vw,360px)] flex-col border-l border-zinc-800 p-4 text-zinc-100 shadow-2xl"
                style={{ backgroundColor: "#0e0f12", opacity: 1 }}
              >
                <div className="flex items-center justify-between border-b border-zinc-200 bg-[#fbfbfc] px-2 pb-4 pt-2 dark:border-zinc-800 dark:bg-[#0e0f12]">
                  <KeepLogo />
                  <button
                    aria-label="Close navigation"
                    className="flex size-10 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-900 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
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
                <div className="mt-4 border-t pt-4">
                  <VaultQuickControl mobile />
                </div>
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
                        {userName ?? "Keep user"}
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
