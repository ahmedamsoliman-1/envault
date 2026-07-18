import { KeepClient } from "@keephq/api-client";
import { detectSensitivity } from "@keephq/domain";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { load, type Store } from "@tauri-apps/plugin-store";

const SERVER = "https://keep.aamsdn.space";
const POLL_MS = 1000;
const MAX_RECENT = 25;

let store: Store;
let token: string | null = null;
let paused = false;
let lastText = "";
let watching = false;

// All API traffic goes through the Tauri HTTP plugin (Rust side) so requests
// are not subject to the webview's cross-origin restrictions.
const client = new KeepClient({
  baseUrl: SERVER,
  getAccessToken: () => Promise.resolve(token),
  fetch: tauriFetch as unknown as typeof globalThis.fetch,
});

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const firstLine = (t: string) => t.replace(/\s+/gu, " ").trim().slice(0, 60);

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

// --- UI helpers ---

function setStatus(state: "off" | "on" | "paused") {
  const dot = $("status-dot");
  dot.className = `dot dot--${state}`;
  dot.title = state === "on" ? "syncing" : state === "paused" ? "paused" : "disconnected";
}

function showConnect(hint = "") {
  $("view-connect").classList.remove("hidden");
  $("view-main").classList.add("hidden");
  $("connect-hint").textContent = hint;
  setStatus("off");
}

function connectHint(text: string) {
  $("connect-hint").textContent = text;
}

async function showMain(deviceName: string) {
  $("view-connect").classList.add("hidden");
  $("view-main").classList.remove("hidden");
  $("device-name").textContent = deviceName;
  setStatus(paused ? "paused" : "on");
  try {
    ($("autostart-toggle") as HTMLInputElement).checked = await isEnabled();
  } catch {
    /* autostart may be unavailable in dev */
  }
}

function addRecent(entry: { preview: string; meta: string; skipped: boolean }) {
  const list = $("recent");
  list.querySelector(".empty")?.remove();
  const li = document.createElement("li");
  const preview = document.createElement("span");
  preview.className = "preview";
  preview.textContent = entry.preview;
  const meta = document.createElement("span");
  meta.className = entry.skipped ? "meta skipped" : "meta";
  meta.textContent = entry.meta;
  li.append(preview, meta);
  list.prepend(li);
  while (list.children.length > MAX_RECENT) list.lastElementChild?.remove();
}

// --- Pairing (device authorization, PKCE) ---

async function connect() {
  const button = $("connect-btn") as HTMLButtonElement;
  button.disabled = true;
  connectHint("Reaching Keep…");
  try {
    const { verifier, challenge } = await pkce();
    const auth = await client.devices.createAuthorization({
      deviceName: "Keep Clipboard (macOS)",
      clientName: "Keep Clipboard for macOS",
      codeChallenge: challenge,
      scopes: ["clipboard:read", "clipboard:write"],
    });
    connectHint(`Approve code ${auth.userCode} in your browser…`);
    try {
      await openUrl(auth.verificationUri);
    } catch {
      connectHint(`Open ${auth.verificationUri} and approve code ${auth.userCode}.`);
    }

    const expires = new Date(auth.expiresAt).getTime();
    while (Date.now() < expires) {
      await sleep(auth.intervalSeconds * 1000);
      const result = await client.devices.exchange(auth.authorizationId, verifier);
      if (result.status === "authorized") {
        token = result.accessToken;
        await store.set("token", token);
        await store.set("deviceName", result.session.deviceName);
        await store.save();
        await showMain(result.session.deviceName);
        void startWatching();
        return;
      }
    }
    connectHint("Pairing expired — try again.");
  } catch (error) {
    connectHint(`Pairing failed: ${msg(error)}`);
  } finally {
    button.disabled = false;
  }
}

async function signOut() {
  token = null;
  await store.delete("token");
  await store.delete("deviceName");
  await store.save();
  showConnect("Signed out.");
}

// --- The watch loop ---

async function startWatching() {
  if (watching) return;
  watching = true;
  try {
    lastText = (await readText()) ?? ""; // baseline: don't send what's already copied
  } catch {
    lastText = "";
  }
  setInterval(() => void tick(), POLL_MS);
}

async function tick() {
  if (paused || !token) return;
  let text: string;
  try {
    text = (await readText()) ?? ""; // throws when the clipboard holds non-text
  } catch {
    return;
  }
  if (!text || text === lastText) return;
  lastText = text;
  if (!text.trim()) return;

  if (detectSensitivity(text) === "secret") {
    addRecent({ preview: firstLine(text), meta: "skipped · looks like a secret", skipped: true });
    return;
  }
  try {
    const item = await client.clipboard.create({
      content: text,
      originClient: "macos",
      persistenceMode: "temporary",
    });
    const tag =
      item.sensitivity === "normal"
        ? item.contentType
        : `${item.contentType} · ${item.sensitivity}`;
    addRecent({ preview: item.safePreview ?? firstLine(text), meta: `sent · ${tag}`, skipped: false });
  } catch (error) {
    addRecent({ preview: firstLine(text), meta: `error · ${msg(error)}`, skipped: true });
  }
}

// --- Wiring ---

async function init() {
  store = await load("keep-clipboard.json");
  token = (await store.get<string>("token")) ?? null;

  $("connect-btn").addEventListener("click", () => void connect());
  $("signout-btn").addEventListener("click", () => void signOut());

  ($("pause-toggle") as HTMLInputElement).addEventListener("change", (event) => {
    paused = (event.target as HTMLInputElement).checked;
    setStatus(paused ? "paused" : "on");
  });

  ($("autostart-toggle") as HTMLInputElement).addEventListener("change", async (event) => {
    const on = (event.target as HTMLInputElement).checked;
    try {
      await (on ? enable() : disable());
    } catch {
      /* ignore in dev */
    }
  });

  if (token) {
    await showMain((await store.get<string>("deviceName")) ?? "This Mac");
    void startWatching();
  } else {
    showConnect();
  }
}

window.addEventListener("DOMContentLoaded", () => void init());
