export type ClipboardContentType = "text" | "url" | "code" | "json" | "command";

export type ClipboardSensitivity = "normal" | "sensitive" | "secret";

export type ClipboardPersistenceMode = "once" | "temporary" | "pinned";

export type ClipboardOriginClient =
  "web" | "vscode" | "macos" | "windows" | "android" | "ios";

export interface ClipboardItem {
  id: string;
  ownerId: string;
  contentType: ClipboardContentType;
  content: string;
  safePreview: string | null;
  contentHash: string;
  byteLength: number;
  sensitivity: ClipboardSensitivity;
  persistenceMode: ClipboardPersistenceMode;
  originClient: ClipboardOriginClient;
  language: string | null;
  createdAt: string;
  expiresAt: string | null;
  pinnedAt: string | null;
  consumedAt: string | null;
}

export interface ClipboardRetentionConfig {
  defaultTtlSeconds: number;
  oneTimeTtlSeconds: number;
  sensitiveTtlSeconds: number;
}

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u, // AWS access key id
  /\bASIA[0-9A-Z]{16}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u, // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u, // Slack tokens
  /\bsk-[A-Za-z0-9]{20,}\b/u, // OpenAI-style tokens
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u, // JWT
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|token)\b\s*[:=]/iu,
  /authorization:\s*bearer\s+/iu,
  /\bbearer\s+[A-Za-z0-9._-]{10,}/iu,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s:@/]+@/iu, // credentials in a URL
  /AWS_SECRET_ACCESS_KEY/iu,
];

const HIGH_ENTROPY_TOKEN =
  /(?:^|[\s:="'`])[A-Za-z0-9+/_-]{32,}={0,2}(?:$|[\s"'`])/u;

/**
 * Classifies clipboard content by how sensitive it is likely to be. This is a
 * best-effort signal used to suppress previews and shorten retention — never a
 * security guarantee.
 */
export function detectSensitivity(content: string): ClipboardSensitivity {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) return "secret";
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(content)))
    return "sensitive";
  if (HIGH_ENTROPY_TOKEN.test(content.trim())) return "sensitive";
  return "normal";
}

const URL_ONLY = /^[a-z][a-z0-9+.-]*:\/\/\S+$/iu;
const COMMAND_LEADERS = new Set([
  "sudo",
  "kubectl",
  "docker",
  "npm",
  "pnpm",
  "yarn",
  "npx",
  "git",
  "curl",
  "wget",
  "cd",
  "ls",
  "cat",
  "brew",
  "apt",
  "apt-get",
  "make",
  "terraform",
  "aws",
  "gcloud",
  "ssh",
  "export",
]);
const CODE_HINT =
  /[{};]|=>|\b(?:function|const|let|import|export|def|class)\b/u;

export function inferContentType(content: string): ClipboardContentType {
  const trimmed = content.trim();
  if (!trimmed) return "text";
  if (URL_ONLY.test(trimmed)) return "url";
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // fall through to other heuristics
    }
  }
  const singleLine = !trimmed.includes("\n");
  if (
    singleLine &&
    (trimmed.startsWith("$ ") ||
      COMMAND_LEADERS.has(trimmed.split(/\s+/u)[0] ?? ""))
  ) {
    return "command";
  }
  if (!singleLine || CODE_HINT.test(trimmed)) return "code";
  return "text";
}

const PREVIEW_MAX = 100;

/**
 * A short, single-line preview for list views. Returns null for anything not
 * classified as `normal` so sensitive material is never rendered as a preview.
 */
export function buildSafePreview(
  content: string,
  sensitivity: ClipboardSensitivity,
): string | null {
  if (sensitivity !== "normal") return null;
  const collapsed = content.replace(/\s+/gu, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > PREVIEW_MAX
    ? `${collapsed.slice(0, PREVIEW_MAX)}…`
    : collapsed;
}

/**
 * Computes the absolute expiry for an item. Pinned items never expire; one-time
 * items use the short TTL; sensitive/secret items are capped to the sensitive
 * TTL even when kept as ordinary temporary items.
 */
export function computeExpiry(input: {
  persistenceMode: ClipboardPersistenceMode;
  sensitivity: ClipboardSensitivity;
  createdAtMs: number;
  config: ClipboardRetentionConfig;
}): string | null {
  const { persistenceMode, sensitivity, createdAtMs, config } = input;
  if (persistenceMode === "pinned") return null;
  let ttlSeconds: number;
  if (persistenceMode === "once") {
    ttlSeconds = config.oneTimeTtlSeconds;
  } else {
    ttlSeconds =
      sensitivity === "normal"
        ? config.defaultTtlSeconds
        : Math.min(config.defaultTtlSeconds, config.sensitiveTtlSeconds);
  }
  return new Date(createdAtMs + ttlSeconds * 1000).toISOString();
}

export function isClipboardItemExpired(
  item: Pick<ClipboardItem, "expiresAt">,
  nowMs: number,
): boolean {
  return item.expiresAt !== null && Date.parse(item.expiresAt) <= nowMs;
}
