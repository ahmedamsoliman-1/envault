import {
  ChevronRight,
  ClipboardList,
  Download,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { KeepLogo } from "@/components/brand/keep-logo";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { VaultQuickControl } from "@/components/vault/vault-quick-control";
import { isClipboardEnabled, isPasswordsEnabled } from "@/lib/features";

const navigation = [
  { href: "/app/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  ...(isPasswordsEnabled()
    ? [{ href: "/app/passwords", label: "Passwords", icon: KeyRound }]
    : []),
  ...(isClipboardEnabled()
    ? [{ href: "/app/clipboard", label: "Clipboard", icon: ClipboardList }]
    : []),
];

export function AppShell({
  children,
  title,
  eyebrow,
  userEmail,
  userName,
  actions,
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  userEmail: string | null;
  userName?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--app-background)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-[var(--sidebar)] p-4 lg:flex">
        <Link className="px-2 py-2" href="/app/dashboard">
          <KeepLogo />
        </Link>
        <nav className="mt-8 space-y-1">
          {navigation.map((item) => (
            <Link
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4">
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            href="/app/profile"
          >
            <UserRound className="size-4" />
            Profile
          </Link>
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            href="/app/settings"
          >
            <Settings className="size-4" />
            Settings
          </Link>
          <Link
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            href="/download"
          >
            <Download className="size-4" />
            Download apps
          </Link>
        </div>
        <div className="mt-auto rounded-xl border bg-[var(--surface)] p-2">
          <Link
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--surface-hover)]"
            href="/app/profile"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-sm font-semibold text-indigo-600">
              {(userName ?? userEmail ?? "E").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">
                {userName ?? "Keep user"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                {userEmail ?? "Individual workspace"}
              </span>
            </span>
            <ChevronRight className="size-3.5 text-[var(--muted)]" />
          </Link>
          <div className="mt-1 border-t pt-1">
            <LogoutButton variant="sidebar" />
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b bg-[color:var(--app-background)/0.92] px-5 backdrop-blur lg:px-8">
          <MobileNavigation userEmail={userEmail} userName={userName} />
          <div className="hidden lg:block">
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-base font-semibold">{title}</h1>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <GlobalCommandPalette />
            <VaultQuickControl />
            {actions}
          </div>
        </header>
        <main className="px-5 py-8 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
