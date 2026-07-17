import { describe, expect, it } from "vitest";

import {
  buildSafePreview,
  computeExpiry,
  detectSensitivity,
  inferContentType,
  isClipboardItemExpired,
} from "./clipboard";

const config = {
  defaultTtlSeconds: 604_800,
  oneTimeTtlSeconds: 600,
  sensitiveTtlSeconds: 3_600,
};

describe("detectSensitivity", () => {
  it("flags private keys and tokens as secret", () => {
    expect(detectSensitivity("-----BEGIN OPENSSH PRIVATE KEY-----\nabc")).toBe(
      "secret",
    );
    expect(detectSensitivity("token ghp_" + "a".repeat(30))).toBe("secret");
    expect(
      detectSensitivity(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      ),
    ).toBe("secret");
  });

  it("flags password assignments and bearer headers as sensitive", () => {
    expect(detectSensitivity("PASSWORD=hunter2")).toBe("sensitive");
    expect(detectSensitivity("Authorization: Bearer abc123def456")).toBe(
      "sensitive",
    );
    expect(detectSensitivity("postgres://user:pass@host:5432/db")).toBe(
      "sensitive",
    );
  });

  it("treats ordinary text and commands as normal", () => {
    expect(detectSensitivity("kubectl get pods -n argocd")).toBe("normal");
    expect(detectSensitivity("just some notes")).toBe("normal");
  });
});

describe("inferContentType", () => {
  it("detects urls, json, commands and code", () => {
    expect(inferContentType("https://github.com/x/y")).toBe("url");
    expect(inferContentType('{"a":1}')).toBe("json");
    expect(inferContentType("kubectl get pods")).toBe("command");
    expect(inferContentType("$ ls -la")).toBe("command");
    expect(inferContentType("const x = 1;")).toBe("code");
    expect(inferContentType("plain sentence")).toBe("text");
  });
});

describe("buildSafePreview", () => {
  it("returns a collapsed preview for normal content", () => {
    expect(buildSafePreview("hello   world\nagain", "normal")).toBe(
      "hello world again",
    );
  });
  it("returns null for sensitive or secret content", () => {
    expect(buildSafePreview("PASSWORD=x", "sensitive")).toBeNull();
    expect(buildSafePreview("key", "secret")).toBeNull();
  });
  it("truncates long previews", () => {
    const preview = buildSafePreview("a".repeat(250), "normal");
    expect(preview).toHaveLength(101);
    expect(preview?.endsWith("…")).toBe(true);
  });
});

describe("computeExpiry", () => {
  const createdAtMs = Date.parse("2026-01-01T00:00:00.000Z");
  it("never expires pinned items", () => {
    expect(
      computeExpiry({
        persistenceMode: "pinned",
        sensitivity: "normal",
        createdAtMs,
        config,
      }),
    ).toBeNull();
  });
  it("uses the short TTL for one-time items", () => {
    expect(
      computeExpiry({
        persistenceMode: "once",
        sensitivity: "normal",
        createdAtMs,
        config,
      }),
    ).toBe("2026-01-01T00:10:00.000Z");
  });
  it("caps sensitive temporary items to the sensitive TTL", () => {
    expect(
      computeExpiry({
        persistenceMode: "temporary",
        sensitivity: "secret",
        createdAtMs,
        config,
      }),
    ).toBe("2026-01-01T01:00:00.000Z");
  });
});

describe("isClipboardItemExpired", () => {
  it("respects the expiry timestamp", () => {
    const now = Date.parse("2026-01-01T00:05:00.000Z");
    expect(
      isClipboardItemExpired({ expiresAt: "2026-01-01T00:04:00.000Z" }, now),
    ).toBe(true);
    expect(
      isClipboardItemExpired({ expiresAt: "2026-01-01T00:06:00.000Z" }, now),
    ).toBe(false);
    expect(isClipboardItemExpired({ expiresAt: null }, now)).toBe(false);
  });
});
