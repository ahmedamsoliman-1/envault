"use client";

import {
  FolderKanban,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";

const commands = [
  {
    label: "Open dashboard",
    keywords: "home overview",
    href: "/app/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Open projects",
    keywords: "projects environments variables",
    href: "/app/projects",
    icon: FolderKanban,
  },
  {
    label: "Open security settings",
    keywords: "settings vault passkey mfa biometric",
    href: "/app/settings",
    icon: ShieldCheck,
  },
  {
    label: "Open account settings",
    keywords: "settings preferences account",
    href: "/app/settings",
    icon: Settings,
  },
  {
    label: "Open profile",
    keywords: "profile name email",
    href: "/app/profile",
    icon: UserRound,
  },
] as const;

export function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.keywords}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <>
      <button
        aria-label="Open command palette"
        className="hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] lg:inline-flex"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search className="size-3.5" />
        Commands
        <kbd className="rounded border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>
      <ActionDialog
        description="Navigate Envault and open common security workflows."
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        open={open}
        title="Command palette"
      >
        <input
          autoFocus
          className="w-full rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-indigo-500"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands…"
          value={query}
        />
        <div className="mt-4 space-y-2">
          {filtered.map((command) => (
            <button
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-[var(--surface-hover)]"
              key={command.label}
              onClick={() => {
                setOpen(false);
                setQuery("");
                router.push(command.href);
              }}
              type="button"
            >
              <command.icon className="size-4 text-[var(--muted)]" />
              {command.label}
            </button>
          ))}
          {!filtered.length ? (
            <p className="px-2 py-6 text-center text-sm text-[var(--muted)]">
              No matching commands.
            </p>
          ) : null}
        </div>
      </ActionDialog>
    </>
  );
}
