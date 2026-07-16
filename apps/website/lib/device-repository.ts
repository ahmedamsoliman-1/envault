import "server-only";

import type { DeviceScope, DeviceSession } from "@envault/api-contract";
import { envaultRedisKey, type EnvaultRedis } from "@envault/redis";
import { createHash, randomBytes } from "node:crypto";

interface DeviceAuthorization {
  id: string;
  userCode: string;
  deviceName: string;
  clientName: string;
  scopes: DeviceScope[];
  codeChallenge: string;
  ownerId: string | null;
  approvedAt: string | null;
  usedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

interface StoredDeviceSession extends DeviceSession {
  ownerId: string;
  tokenHash: string;
}

const authorizationKey = (id: string) =>
  envaultRedisKey("device-authorization", id);
const userCodeKey = (code: string) => envaultRedisKey("device-user-code", code);
const sessionKey = (id: string) => envaultRedisKey("device-session", id);
const sessionTokenKey = (hash: string) => envaultRedisKey("device-token", hash);
const ownerSessionsKey = (ownerId: string) =>
  envaultRedisKey("user", ownerId, "device-sessions");

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

export class DeviceRepository {
  public constructor(private readonly redis: EnvaultRedis) {}

  public async createAuthorization(input: {
    deviceName: string;
    clientName: string;
    scopes: DeviceScope[];
    codeChallenge: string;
    ttlSeconds: number;
  }) {
    const id = crypto.randomUUID();
    const userCode = randomBytes(6).toString("base64url").toUpperCase();
    const createdAt = new Date();
    const authorization: DeviceAuthorization = {
      id,
      userCode,
      deviceName: input.deviceName,
      clientName: input.clientName,
      scopes: input.scopes,
      codeChallenge: input.codeChallenge,
      ownerId: null,
      approvedAt: null,
      usedAt: null,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(
        createdAt.getTime() + input.ttlSeconds * 1_000,
      ).toISOString(),
    };
    await this.redis.set(authorizationKey(id), authorization, {
      ex: input.ttlSeconds,
    });
    await this.redis.set(userCodeKey(userCode), id, {
      ex: input.ttlSeconds,
    });
    return authorization;
  }

  public async findAuthorization(id: string) {
    return this.redis.get<DeviceAuthorization>(authorizationKey(id));
  }

  public async findAuthorizationByCode(userCode: string) {
    const id = await this.redis.get<string>(userCodeKey(userCode));
    return id ? this.findAuthorization(id) : null;
  }

  public async approve(id: string, ownerId: string, userCode: string) {
    const key = authorizationKey(id);
    const current = await this.findAuthorization(id);
    if (
      !current ||
      current.userCode !== userCode ||
      current.usedAt ||
      new Date(current.expiresAt).getTime() <= Date.now()
    )
      return false;
    const updated = {
      ...current,
      ownerId,
      approvedAt: new Date().toISOString(),
    };
    return (
      (await this.redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL'); return 1 else return 0 end",
        [key],
        [JSON.stringify(current), JSON.stringify(updated)],
      )) === 1
    );
  }

  public async exchange(
    id: string,
    codeVerifier: string,
    maxAgeSeconds: number,
  ) {
    const key = authorizationKey(id);
    const current = await this.findAuthorization(id);
    if (!current) return { expired: true as const };
    if (current.usedAt) return { used: true as const };
    if (!current.ownerId || !current.approvedAt)
      return { pending: true as const };
    if (sha256(codeVerifier) !== current.codeChallenge)
      return { invalidVerifier: true as const };
    const used = { ...current, usedAt: new Date().toISOString() };
    const committed = await this.redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL'); return 1 else return 0 end",
      [key],
      [JSON.stringify(current), JSON.stringify(used)],
    );
    if (committed !== 1) return { used: true as const };

    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const createdAt = new Date();
    const session: StoredDeviceSession = {
      id: crypto.randomUUID(),
      ownerId: current.ownerId,
      deviceName: current.deviceName,
      clientName: current.clientName,
      scopes: current.scopes,
      tokenHash,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(
        createdAt.getTime() + maxAgeSeconds * 1_000,
      ).toISOString(),
      lastUsedAt: null,
    };
    const ids =
      (await this.redis.get<string[]>(ownerSessionsKey(current.ownerId))) ?? [];
    await this.redis.set(sessionKey(session.id), session, {
      ex: maxAgeSeconds,
    });
    await this.redis.set(sessionTokenKey(tokenHash), session.id, {
      ex: maxAgeSeconds,
    });
    await this.redis.set(ownerSessionsKey(current.ownerId), [
      ...new Set([...ids, session.id]),
    ]);
    return { token, session };
  }

  public async listSessions(ownerId: string) {
    const ids =
      (await this.redis.get<string[]>(ownerSessionsKey(ownerId))) ?? [];
    const sessions = await Promise.all(
      ids.map((id) => this.redis.get<StoredDeviceSession>(sessionKey(id))),
    );
    return sessions.filter(
      (session): session is StoredDeviceSession => session?.ownerId === ownerId,
    );
  }

  public async authenticate(accessToken: string) {
    const tokenHash = sha256(accessToken);
    const id = await this.redis.get<string>(sessionTokenKey(tokenHash));
    if (!id) return null;
    const session = await this.redis.get<StoredDeviceSession>(sessionKey(id));
    if (
      !session ||
      session.tokenHash !== tokenHash ||
      new Date(session.expiresAt).getTime() <= Date.now()
    )
      return null;
    return session;
  }

  public async revoke(ownerId: string, id: string) {
    const session = await this.redis.get<StoredDeviceSession>(sessionKey(id));
    if (!session || session.ownerId !== ownerId) return false;
    await this.redis.del(sessionKey(id));
    await this.redis.del(sessionTokenKey(session.tokenHash));
    const ids =
      (await this.redis.get<string[]>(ownerSessionsKey(ownerId))) ?? [];
    await this.redis.set(
      ownerSessionsKey(ownerId),
      ids.filter((value) => value !== id),
    );
    return true;
  }
}
