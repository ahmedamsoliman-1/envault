import type { ImportEnvironmentRequest } from "@keephq/api-contract";
import { describe, expect, it } from "vitest";

import type { KeepRedis } from "./index";
import {
  RedisEnvironmentRepository,
  RedisProjectRepository,
  RedisVaultRepository,
} from "./repositories";

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

  // Streams are exercised by clipboard-event-log.test.ts; unused here.
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
  const project = await new RedisProjectRepository(redis).create(ownerId, {
    name: "Keep",
    description: null,
  });
  const repository = new RedisEnvironmentRepository(redis);
  const environment = await repository.create(ownerId, project!.id, {
    name: "Development",
    kind: "development",
  });
  return { redis, ownerId, repository, environment: environment! };
}

describe("Redis synchronization safeguards", () => {
  it("maintains a non-sensitive workspace overview", async () => {
    const { redis, ownerId, repository, environment } = await setup();
    await repository.createVariable(ownerId, environment.id, {
      id: "10000000-0000-4000-8000-000000000000",
      projectId: environment.projectId,
      key: "API_URL",
      encryptedValue: "ciphertext",
      encryptionIv: "initialization-vector",
      encryptionVersion: 1,
      visibility: "secret",
      tags: [],
      description: null,
      expectedVersion: 0,
    });

    await expect(
      new RedisProjectRepository(redis).overview(ownerId),
    ).resolves.toMatchObject({
      projectCount: 1,
      environmentCount: 1,
      variableCount: 1,
      projects: [{ environments: [{ variableCount: 1 }] }],
    });
  });
  it("rejects a stale expected environment version", async () => {
    const { ownerId, repository, environment } = await setup();
    const created = await repository.createVariable(ownerId, environment.id, {
      id: "30000000-0000-4000-8000-000000000000",
      projectId: environment.projectId,
      key: "API_URL",
      encryptedValue: "ciphertext",
      encryptionIv: "initialization-vector",
      encryptionVersion: 1,
      visibility: "secret",
      tags: [],
      description: null,
      expectedVersion: 0,
    });
    expect(created).toMatchObject({ version: 1 });

    await expect(
      repository.createVariable(ownerId, environment.id, {
        id: "40000000-0000-4000-8000-000000000000",
        projectId: environment.projectId,
        key: "API_TOKEN",
        encryptedValue: "ciphertext",
        encryptionIv: "initialization-vector",
        encryptionVersion: 1,
        visibility: "secret",
        tags: [],
        description: null,
        expectedVersion: 0,
      }),
    ).resolves.toEqual({ conflictVersion: 1 });
  });

  it("replays an import operation without applying it twice", async () => {
    const { ownerId, repository, environment } = await setup();
    const request: ImportEnvironmentRequest = {
      operationId: "50000000-0000-4000-8000-000000000000",
      expectedVersion: 0,
      variables: [
        {
          id: "60000000-0000-4000-8000-000000000000",
          projectId: environment.projectId,
          key: "DATABASE_URL",
          encryptedValue: "ciphertext",
          encryptionIv: "initialization-vector",
          encryptionVersion: 1,
          visibility: "secret",
          tags: [],
          description: null,
        },
      ],
    };

    await expect(
      repository.importVariables(ownerId, environment.id, {
        ...request,
        operationId: "70000000-0000-4000-8000-000000000000",
        expectedVersion: 2,
      }),
    ).resolves.toEqual({ conflictVersion: 0 });
    await expect(
      repository.importVariables(ownerId, environment.id, request),
    ).resolves.toMatchObject({ replayed: false, version: 1 });
    await expect(
      repository.importVariables(ownerId, environment.id, request),
    ).resolves.toMatchObject({ replayed: true, version: 1 });
  });

  it("rejects stale bulk synchronization operations", async () => {
    const { ownerId, repository, environment } = await setup();
    await expect(
      repository.bulkVariables(ownerId, environment.id, {
        operationId: "80000000-0000-4000-8000-000000000000",
        expectedVersion: 3,
        updates: [],
        deleteIds: [],
      }),
    ).resolves.toEqual({ conflictVersion: 0 });
  });
});
