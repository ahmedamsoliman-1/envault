import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Cpu,
  Download,
  MonitorSmartphone,
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
const RELEASES_URL = "https://github.com/ahmedamsoliman-1/keep/releases";
const RELEASE_API =
  "https://api.github.com/repos/ahmedamsoliman-1/keep/releases/latest";
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

const WINDOWS_FEATURES = [
  "Automatic clipboard sending with likely-secret filtering",
  "Remote history with click-to-copy and one-time items",
  "Native system tray and start-at-login support",
];

const ANDROID_FEATURES = [
  "Share text explicitly through Keep",
  "Browse history and tap an item to copy",
  "Samsung tablet and DeX-friendly interface",
];

const STEPS = [
  {
    title: "Download & open",
    body: "Grab the .dmg and drag Keep Clipboard to Applications. On first launch, clear the quarantine flag (see the note under the button).",
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

type ReleaseAsset = { name: string; browser_download_url: string };

async function getReleaseAssets(): Promise<ReleaseAsset[]> {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const release = (await response.json()) as { assets?: ReleaseAsset[] };
    return release.assets ?? [];
  } catch {
    return [];
  }
}

export default async function DownloadPage() {
  const assets = await getReleaseAssets();
  const windowsDownload = assets.find(
    (asset) => asset.name === "Keep-Clipboard-Windows-x64-Setup.exe",
  )?.browser_download_url;
  const androidDownload = assets.find(
    (asset) => asset.name === "Keep-Clipboard-Android-universal.apk",
  )?.browser_download_url;

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
            Install the desktop app and the editor extension. Copy on one
            device, paste on another — with likely secrets filtered out
            automatically.
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
                <span>macOS 12+</span>
              </p>

              <details className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-white/60">
                <summary className="cursor-pointer font-medium text-amber-200/90">
                  macOS says it’s “damaged”? Read this first.
                </summary>
                <p className="mt-2 leading-5">
                  It isn’t — this early build isn’t notarized by Apple yet, so
                  macOS blocks it after download. Open Terminal and run this
                  once, then open the app normally:
                </p>
                <code className="mt-2 block overflow-x-auto rounded bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white/80">
                  xattr -dr com.apple.quarantine &quot;/Applications/Keep
                  Clipboard.app&quot;
                </code>
              </details>
            </div>
          </article>

          {/* Windows app */}
          <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <MonitorSmartphone className="size-6 text-indigo-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  Keep Clipboard for Windows
                </h2>
                <p className="text-xs text-white/50">Desktop companion</p>
              </div>
            </div>
            <ul className="mt-6 space-y-2.5">
              {WINDOWS_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-2.5 text-sm text-white/70"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3">
              {windowsDownload ? (
                <a
                  href={windowsDownload}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                >
                  <Download className="size-4" /> Download for Windows
                </a>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/45">
                  Windows release in progress
                </span>
              )}
              <p className="text-xs text-white/45">
                Windows 10/11 · x64 · versioned GitHub release
              </p>
            </div>
          </article>

          {/* Android app */}
          <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
                <MonitorSmartphone className="size-6 text-indigo-300" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  Keep Clipboard for Android &amp; Samsung
                </h2>
                <p className="text-xs text-white/50">
                  Public beta · direct APK
                </p>
              </div>
            </div>
            <ul className="mt-6 space-y-2.5">
              {ANDROID_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-2.5 text-sm text-white/70"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-indigo-300" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3">
              {androidDownload ? (
                <a
                  href={androidDownload}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
                >
                  <Download className="size-4" /> Download Android APK
                </a>
              ) : (
                <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/45">
                  Native build in progress
                </span>
              )}
              <a
                href={RELEASES_URL}
                className="text-center text-xs text-indigo-300 transition hover:text-indigo-200"
              >
                Follow signed releases on GitHub
              </a>
              <p className="text-xs leading-5 text-white/45">
                Android limits background clipboard access. This beta uses
                explicit sharing and manual sending; Share Sheet, biometrics,
                and notifications will arrive in later updates.
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
