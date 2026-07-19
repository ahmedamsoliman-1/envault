import { KeepClient } from "@keephq/api-client";
import { detectSensitivity } from "@keephq/domain";
import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
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

type Platform = "macos" | "windows" | "android";

const platform: Platform = /Android/iu.test(navigator.userAgent)
  ? "android"
  : /Windows/iu.test(navigator.userAgent)
    ? "windows"
    : "macos";
const isMobile = platform === "android";
document.documentElement.classList.toggle("mobile", isMobile);
const platformLabel =
  platform === "macos"
    ? "Mac"
    : platform === "windows"
      ? "Windows PC"
      : "Android device";
const clientLabel =
  platform === "macos"
    ? "macOS"
    : platform === "windows"
      ? "Windows"
      : "Android";

// All API traffic goes through the Tauri HTTP plugin (Rust side) so requests
// are not subject to the webview's cross-origin restrictions.
const client = new KeepClient({
  baseUrl: SERVER,
  getAccessToken: () => Promise.resolve(token),
  fetch: tauriFetch as unknown as typeof globalThis.fetch,
});

const secureToken = {
  get: () => invoke<string | null>("secure_get_token"),
  set: (value: string) => invoke<void>("secure_set_token", { token: value }),
  delete: () => invoke<void>("secure_delete_token"),
};

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const firstLine = (t: string) => t.replace(/\s+/gu, " ").trim().slice(0, 60);

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
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
  dot.title =
    state === "on" ? "syncing" : state === "paused" ? "paused" : "disconnected";
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
  if (!isMobile) {
    try {
      ($("autostart-toggle") as HTMLInputElement).checked = await isEnabled();
    } catch {
      /* autostart may be unavailable in dev */
    }
  }
  await refreshHistory();
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

async function refreshHistory() {
  const list = $("history");
  list.replaceChildren();
  try {
    const { items } = await client.clipboard.list();
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No remote items yet.";
      list.append(empty);
      return;
    }
    for (const item of items) {
      const li = document.createElement("li");
      const preview = document.createElement("button");
      preview.className = "history-item";
      preview.type = "button";
      preview.textContent = item.safePreview ?? `${item.sensitivity} item`;
      preview.title = "Copy this item";
      preview.addEventListener("click", async () => {
        try {
          const detail =
            item.persistenceMode === "once"
              ? await client.clipboard.consume(item.id)
              : await client.clipboard.get(item.id);
          await writeText(detail.content);
          preview.textContent = "Copied to this device";
          if (item.persistenceMode === "once") await refreshHistory();
          window.setTimeout(() => void refreshHistory(), 1200);
        } catch (error) {
          preview.textContent = `Could not copy: ${msg(error)}`;
        }
      });
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${item.originClient} · ${item.persistenceMode}`;
      li.append(preview, meta);
      list.append(li);
    }
  } catch (error) {
    const failed = document.createElement("li");
    failed.className = "empty";
    failed.textContent = `Could not load history: ${msg(error)}`;
    list.append(failed);
  }
}

async function sendManualText() {
  const input = $("manual-text") as HTMLTextAreaElement;
  const content = input.value.trim();
  if (!content) return;
  const button = $("manual-send") as HTMLButtonElement;
  button.disabled = true;
  try {
    await client.clipboard.create({
      content,
      originClient: platform,
      persistenceMode: "temporary",
    });
    input.value = "";
    await refreshHistory();
  } catch (error) {
    input.setCustomValidity(msg(error));
    input.reportValidity();
  } finally {
    button.disabled = false;
  }
}

// --- Pairing (device authorization, PKCE) ---

async function connect() {
  const button = $("connect-btn") as HTMLButtonElement;
  button.disabled = true;
  connectHint("Reaching Keep…");
  try {
    const { verifier, challenge } = await pkce();
    const auth = await client.devices.createAuthorization({
      deviceName: `Keep Clipboard (${clientLabel})`,
      clientName: `Keep Clipboard for ${clientLabel}`,
      codeChallenge: challenge,
      scopes: ["clipboard:read", "clipboard:write", "clipboard:receive"],
    });
    // The server derives verificationUri from the request Origin, which for
    // this app is `tauri://localhost`. Rebuild it against the real server so
    // the approval page opens on the web, keeping the server-generated path.
    let approveUrl: string;
    try {
      const parsed = new URL(auth.verificationUri);
      approveUrl = `${SERVER}${parsed.pathname}${parsed.search}`;
    } catch {
      approveUrl = `${SERVER}/device?authorizationId=${auth.authorizationId}&code=${auth.userCode}`;
    }
    connectHint(`Approve code ${auth.userCode} in your browser…`);
    try {
      await openUrl(approveUrl);
    } catch {
      connectHint(`Open ${approveUrl} and approve code ${auth.userCode}.`);
    }

    const expires = new Date(auth.expiresAt).getTime();
    let lastExchangeError: string | null = null;
    while (Date.now() < expires) {
      await sleep(auth.intervalSeconds * 1000);
      let result: Awaited<ReturnType<typeof client.devices.exchange>>;
      try {
        result = await client.devices.exchange(auth.authorizationId, verifier);
        lastExchangeError = null;
      } catch (error) {
        // Android can briefly invalidate an in-flight HTTP connection while
        // this activity returns from the external approval browser. Keep the
        // PKCE authorization alive and retry instead of making the user start
        // the entire pairing flow again.
        lastExchangeError = msg(error);
        connectHint("Returning from the browser — reconnecting to Keep…");
        continue;
      }
      if (result.status === "authorized") {
        token = result.accessToken;
        if (isMobile) {
          await secureToken.set(token);
          await store.delete("token");
        } else {
          await store.set("token", token);
        }
        await store.set("deviceName", result.session.deviceName);
        await store.save();
        await showMain(result.session.deviceName);
        if (!isMobile) void startWatching();
        return;
      }
    }
    connectHint(
      lastExchangeError
        ? `Pairing expired after a connection problem: ${lastExchangeError}`
        : "Pairing expired — try again.",
    );
  } catch (error) {
    connectHint(`Pairing failed: ${msg(error)}`);
  } finally {
    button.disabled = false;
  }
}

async function signOut() {
  token = null;
  if (isMobile) await secureToken.delete();
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
    addRecent({
      preview: firstLine(text),
      meta: "skipped · looks like a secret",
      skipped: true,
    });
    return;
  }
  try {
    const item = await client.clipboard.create({
      content: text,
      originClient: platform,
      persistenceMode: "temporary",
    });
    const tag =
      item.sensitivity === "normal"
        ? item.contentType
        : `${item.contentType} · ${item.sensitivity}`;
    addRecent({
      preview: item.safePreview ?? firstLine(text),
      meta: `sent · ${tag}`,
      skipped: false,
    });
  } catch (error) {
    addRecent({
      preview: firstLine(text),
      meta: `error · ${msg(error)}`,
      skipped: true,
    });
  }
}

// --- Wiring ---

async function init() {
  store = await load("keep-clipboard.json");
  const legacyToken = (await store.get<string>("token")) ?? null;
  if (isMobile) {
    token = await secureToken.get();
    if (!token && legacyToken) {
      await secureToken.set(legacyToken);
      token = legacyToken;
      await store.delete("token");
      await store.save();
    }
  } else {
    token = legacyToken;
  }

  $("connect-btn").addEventListener("click", () => void connect());
  $("signout-btn").addEventListener("click", () => void signOut());
  $("refresh-btn").addEventListener("click", () => void refreshHistory());
  $("manual-send").addEventListener("click", () => void sendManualText());

  $("platform-copy").textContent = platformLabel;
  $("connect-copy").textContent = isMobile
    ? "Connect this Android device to share text with Keep and copy items from your history."
    : `Connect this ${platformLabel} to Keep. New clipboard text can be sent automatically; likely secrets are skipped.`;
  $("desktop-controls").classList.toggle("hidden", isMobile);
  $("mobile-compose").classList.toggle("hidden", !isMobile);

  ($("pause-toggle") as HTMLInputElement).addEventListener(
    "change",
    (event) => {
      paused = (event.target as HTMLInputElement).checked;
      setStatus(paused ? "paused" : "on");
    },
  );

  ($("autostart-toggle") as HTMLInputElement).addEventListener(
    "change",
    async (event) => {
      const on = (event.target as HTMLInputElement).checked;
      try {
        await (on ? enable() : disable());
      } catch {
        /* ignore in dev */
      }
    },
  );

  if (token) {
    await showMain(
      (await store.get<string>("deviceName")) ?? `This ${platformLabel}`,
    );
    if (!isMobile) void startWatching();
  } else {
    showConnect();
  }
}

window.addEventListener("DOMContentLoaded", () => void init());
