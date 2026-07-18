import type { KeepRedis } from "@keephq/redis";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { DeviceRepository } from "./device-repository";

vi.mock("server-only", () => ({}));

class MemoryRedis implements KeepRedis {
  private readonly values = new Map<string, unknown>();

  public get<T>(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(
      value === undefined ? null : (structuredClone(value) as T),
    );
  }

  public set(key: string, value: unknown) {
    this.values.set(key, structuredClone(value));
    return Promise.resolve("OK");
  }

  public del(key: string) {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }

  public eval(_script: string, keys: string[], args: string[]) {
    const current = this.values.get(keys[0]!);
    if (JSON.stringify(current) !== args[0]) return Promise.resolve(0);
    this.values.set(keys[0]!, JSON.parse(args[1]!) as unknown);
    return Promise.resolve(1);
  }

  // Clipboard streams are unused by device tests.
  public xadd() {
    return Promise.resolve("0-0");
  }
  public xrange() {
    return Promise.resolve([]);
  }
  public xrevrange() {
    return Promise.resolve([]);
  }
}

describe("DeviceRepository", () => {
  it("approves, exchanges once, lists and revokes a scoped session", async () => {
    const repository = new DeviceRepository(new MemoryRedis());
    const verifier = "a".repeat(48);
    const codeChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    const authorization = await repository.createAuthorization({
      deviceName: "Developer Mac",
      clientName: "Keep for VS Code",
      scopes: ["projects:read", "variables:read"],
      codeChallenge,
      ttlSeconds: 600,
    });

    await expect(
      repository.exchange(authorization.id, verifier, 3_600),
    ).resolves.toEqual({ pending: true });
    await expect(
      repository.approve(authorization.id, "owner", authorization.userCode),
    ).resolves.toBe(true);
    await expect(
      repository.exchange(authorization.id, "b".repeat(48), 3_600),
    ).resolves.toEqual({ invalidVerifier: true });

    const exchanged = await repository.exchange(
      authorization.id,
      verifier,
      3_600,
    );
    expect(exchanged).toMatchObject({
      session: {
        ownerId: "owner",
        deviceName: "Developer Mac",
        scopes: ["projects:read", "variables:read"],
      },
    });
    if (!("token" in exchanged) || typeof exchanged.token !== "string")
      throw new Error("Expected a device token.");
    expect(exchanged.token.length).toBeGreaterThan(32);
    await expect(
      repository.exchange(authorization.id, verifier, 3_600),
    ).resolves.toEqual({ used: true });

    const sessions = await repository.listSessions("owner");
    expect(sessions).toHaveLength(1);
    await expect(repository.revoke("owner", sessions[0]!.id)).resolves.toBe(
      true,
    );
    await expect(repository.listSessions("owner")).resolves.toEqual([]);
  });

  it("stores, isolates and revokes the device-wrapped vault key", async () => {
    const repository = new DeviceRepository(new MemoryRedis());
    const verifier = "c".repeat(48);
    const codeChallenge = createHash("sha256")
      .update(verifier)
      .digest("base64url");
    const authorization = await repository.createAuthorization({
      deviceName: "Developer Mac",
      clientName: "Keep for VS Code",
      scopes: ["variables:read", "variables:write"],
      codeChallenge,
      ttlSeconds: 600,
    });
    await repository.approve(authorization.id, "owner", authorization.userCode);
    const exchanged = await repository.exchange(
      authorization.id,
      verifier,
      3_600,
    );
    if (!("session" in exchanged) || !exchanged.session)
      throw new Error("Expected a session.");
    const sessionId = exchanged.session.id;

    const wrapped = {
      vaultId: "vault-1",
      wrappedKey: {
        version: 1 as const,
        algorithm: "AES-GCM" as const,
        ciphertext: "cipher",
        iv: "iv",
        additionalDataVersion: 1 as const,
      },
    };

    await expect(
      repository.storeVaultKey(sessionId, "owner", wrapped),
    ).resolves.toBe(true);
    await expect(repository.getVaultKey(sessionId, "owner")).resolves.toEqual(
      wrapped,
    );
    // A different owner must never read this device's wrapped key.
    await expect(
      repository.getVaultKey(sessionId, "intruder"),
    ).resolves.toBeNull();

    // Revoking the session removes the wrapped key, disabling silent unlock.
    await repository.revoke("owner", sessionId);
    await expect(
      repository.getVaultKey(sessionId, "owner"),
    ).resolves.toBeNull();
  });
});
