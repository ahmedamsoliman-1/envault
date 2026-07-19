import type {
  CreatePasswordItemRequest,
  ImportPasswordsRequest,
} from "@keephq/api-contract";
import { describe, expect, it } from "vitest";

import type { KeepRedis } from "./index";
import { RedisPasswordRepository, RedisVaultRepository } from "./repositories";

class MemoryRedis implements KeepRedis {
  private readonly values = new Map<string, unknown>();

  public get<T>(key: string) {
    const value = this.values.get(key);
    return Promise.resolve(
      value === undefined ? null : (structuredClone(value) as T),
    );
  }
  public set(key: string, value: unknown) {
    this.values.set(key, value);
    return Promise.resolve("OK");
  }
  public del(key: string) {
    return Promise.resolve(this.values.delete(key) ? 1 : 0);
  }
  public eval(_script: string, keys: string[], args: string[]) {
    if (keys.length === 3) {
      if (this.values.has(keys[0]!) || this.values.has(keys[1]!))
        return Promise.resolve(0);
      this.values.set(keys[0]!, args[0]!);
      this.values.set(keys[1]!, JSON.parse(args[1]!) as unknown);
      this.values.set(keys[2]!, JSON.parse(args[2]!) as unknown);
      return Promise.resolve(1);
    }
    const current = this.values.get(keys[0]!);
    if (JSON.stringify(current) !== args[0]) return Promise.resolve(0);
    this.values.set(keys[0]!, JSON.parse(args[1]!) as unknown);
    this.values.set(keys[1]!, JSON.parse(args[2]!) as unknown);
    return Promise.resolve(1);
  }
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

async function setup() {
  const redis = new MemoryRedis();
  const ownerId = "user";
  await new RedisVaultRepository(redis).create(ownerId, {
    vaultId: "20000000-0000-4000-8000-000000000000",
    protocolVersion: 1,
    passphraseDerivation: {
      version: 1,
      algorithm: "PBKDF2-SHA-256",
      salt: "long-enough-passphrase-salt",
      iterations: 600_000,
    },
    passphraseWrappedKey: {
      version: 1,
      algorithm: "AES-GCM",
      ciphertext: "long-enough-passphrase-wrapped-ciphertext",
      iv: "passphrase-initialization-vector",
      additionalDataVersion: 1,
    },
    recoveryDerivation: {
      version: 1,
      algorithm: "PBKDF2-SHA-256",
      salt: "long-enough-recovery-salt",
      iterations: 600_000,
    },
    recoveryWrappedKey: {
      version: 1,
      algorithm: "AES-GCM",
      ciphertext: "long-enough-recovery-wrapped-ciphertext",
      iv: "recovery-initialization-vector",
      additionalDataVersion: 1,
    },
    autoLockMinutes: 15,
  });
  return { ownerId, repository: new RedisPasswordRepository(redis) };
}

const entry = (id: string): CreatePasswordItemRequest => ({
  id,
  encryptedData: "ciphertext",
  encryptionIv: "initialization-vector",
  encryptionVersion: 1,
});

describe("RedisPasswordRepository", () => {
  it("creates, lists, updates, and deletes entries with per-item versions", async () => {
    const { ownerId, repository } = await setup();
    const id = "10000000-0000-4000-8000-000000000000";

    const created = await repository.create(ownerId, entry(id));
    expect(created).toMatchObject({ item: { id, version: 0 } });
    await expect(repository.list(ownerId)).resolves.toHaveLength(1);

    const updated = await repository.update(ownerId, id, {
      encryptedData: "next-ciphertext",
      encryptionIv: "next-iv",
      encryptionVersion: 1,
      expectedVersion: 0,
    });
    expect(updated).toMatchObject({ version: 1 });

    await expect(repository.delete(ownerId, id, 1)).resolves.toEqual({
      deleted: true,
    });
    await expect(repository.list(ownerId)).resolves.toHaveLength(0);
  });

  it("rejects a duplicate id and a stale expected version", async () => {
    const { ownerId, repository } = await setup();
    const id = "30000000-0000-4000-8000-000000000000";
    await repository.create(ownerId, entry(id));

    await expect(repository.create(ownerId, entry(id))).resolves.toEqual({
      duplicate: true,
    });
    await expect(
      repository.update(ownerId, id, {
        encryptedData: "x",
        encryptionIv: "y",
        encryptionVersion: 1,
        expectedVersion: 5,
      }),
    ).resolves.toEqual({ conflictVersion: 0 });
    await expect(repository.delete(ownerId, id, 9)).resolves.toEqual({
      conflictVersion: 0,
    });
  });

  it("returns null for a missing entry", async () => {
    const { ownerId, repository } = await setup();
    await expect(
      repository.delete(ownerId, "40000000-0000-4000-8000-000000000000", 0),
    ).resolves.toBeNull();
  });

  it("replays an import operation without applying it twice", async () => {
    const { ownerId, repository } = await setup();
    const request: ImportPasswordsRequest = {
      operationId: "50000000-0000-4000-8000-000000000000",
      items: [entry("60000000-0000-4000-8000-000000000000")],
    };
    await expect(
      repository.importItems(ownerId, request),
    ).resolves.toMatchObject({ replayed: false });
    await expect(
      repository.importItems(ownerId, request),
    ).resolves.toMatchObject({ replayed: true });
    await expect(repository.list(ownerId)).resolves.toHaveLength(1);
  });
});
