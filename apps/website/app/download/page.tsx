import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Cpu,
  Download,
  Puzzle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { KeepLogo, KeepMark } from "@/components/brand/keep-logo";

export const metadata: Metadata = {
  title: "Download Keep",
  description:
    "Get the Keep Clipboard app for macOS and the Keep extension for VS Code.",
};

const MAC_DMG = "/downloads/Keep-Clipboard-0.1.0-arm64.dmg";
const VSCODE_URL =
  "https://marketplace.visualstudio.com/items?itemName=keep.keep-vscode";

const MAC_FEATURES = [
  "Everything you copy syncs to Keep automatically",
  "Likely secrets (keys, tokens, passwords) are skipped",
  "Lives in the menu bar and starts at login",
];

const VSCODE_FEATURES = [
  "Send the current selection to Keep Clipboard",
  "Browse and insert clipboard history without leaving the editor",
  "Pull and push encrypted environment secrets",
];

const STEPS = [
  {
    title: "Download & open",
    body: "Grab the .dmg, drag Keep Clipboard to Applications, and open it (right-click → Open the first time).",
  },
  {
    title: "Connect this Mac",
    body: "Click “Connect this Mac” and approve the device in your browser — no password is typed into the app.",
  },
  {
    title: "Just copy",
    body: "Copy anything. It appears in Keep on the web and on your other devices within about a second.",
  },
];

export default function DownloadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#111318] text-white">
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -left-40 -top-40 size-[32rem] rounded-full bg-indigo-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-[-16rem] size-[36rem] rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <Link href="/">
            <KeepLogo className="[--foreground:white] [--logo-cutout:#111318]" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            Open Keep <ArrowRight className="size-4" />
          </Link>
        </header>

        <section className="mx-auto mt-16 max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <Sparkles className="size-3.5 text-indigo-300" />
            Keep on every device
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.045em]">
            Your clipboard, everywhere you work.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-white/55">
            Install the desktop app and the editor extension. Copy on one device,
            paste on another — with likely secrets filtered out automatically.
          </p>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          {/* macOS app */}
          <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <KeepMark className="size-6 text-white [--logo-cutout:#111318]" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  Keep Clipboard for macOS
                </h2>
                <p className="text-xs text-white/50">Menu-bar app</p>
              </div>
            </div>

            <ul className="mt-6 space-y-2.5">
              {MAC_FEATURES.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-white/70">
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3">
              <a
                href={MAC_DMG}
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                <Download className="size-4" /> Download for macOS
              </a>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
                <span className="inline-flex items-center gap-1">
                  <Cpu className="size-3.5" /> Apple Silicon
                </span>
                <span>·</span>
                <span>v0.1.0</span>
                <span>·</span>
                <span>Unsigned — right-click → Open</span>
              </p>
            </div>
          </article>

          {/* VS Code extension */}
          <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <Puzzle className="size-6 text-indigo-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  Keep for VS Code
                </h2>
                <p className="text-xs text-white/50">Editor extension</p>
              </div>
            </div>

            <ul className="mt-6 space-y-2.5">
              {VSCODE_FEATURES.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-white/70">
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3">
              <a
                href={VSCODE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Puzzle className="size-4" /> Get the extension
              </a>
              <p className="text-xs text-white/45">
                Or search “Keep” in the VS Code Extensions view.
              </p>
            </div>
          </article>
        </section>

        <section className="mt-16">
          <h3 className="flex items-center gap-2 text-sm font-medium text-white/70">
            <ClipboardCheck className="size-4 text-indigo-300" />
            How the Mac app works
          </h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <span className="text-xs font-semibold text-indigo-300">
                  Step {index + 1}
                </span>
                <h4 className="mt-1 text-sm font-semibold">{step.title}</h4>
                <p className="mt-1.5 text-sm leading-6 text-white/55">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-16 flex items-center gap-2 border-t border-white/10 pt-6 text-xs text-white/40">
          <ShieldCheck className="size-3.5" />
          Requires a Keep account — you’ll sign in when connecting a device.
        </footer>
      </div>
    </main>
  );
}
