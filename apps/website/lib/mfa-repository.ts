import "server-only";

import { envaultRedisKey, type EnvaultRedis } from "@envault/redis";

import { decryptMfaSecret, encryptMfaSecret, verifyTotp } from "./custom-totp";

interface MfaDocument {
  encryptedSecret: string;
  enabled: boolean;
  lastUsedCounter: number | null;
  createdAt: string;
  updatedAt: string;
}

const keyFor = (userId: string) => envaultRedisKey("mfa", userId);

export class MfaRepository {
  public constructor(
    private readonly redis: EnvaultRedis,
    private readonly encryptionKey: string,
  ) {}

  public async status(userId: string) {
    const document = await this.redis.get<MfaDocument>(keyFor(userId));
    return { enabled: document?.enabled === true };
  }

  public async begin(userId: string, secret: string) {
    const timestamp = new Date().toISOString();
    await this.redis.set(keyFor(userId), {
      encryptedSecret: encryptMfaSecret(secret, this.encryptionKey),
      enabled: false,
      lastUsedCounter: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies MfaDocument);
  }

  public async confirm(userId: string, code: string) {
    return this.verify(userId, code, true);
  }

  public async verify(userId: string, code: string, enable = false) {
    const key = keyFor(userId);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const document = await this.redis.get<MfaDocument>(key);
      if (!document || (!enable && !document.enabled)) return false;
      const counter = verifyTotp(
        decryptMfaSecret(document.encryptedSecret, this.encryptionKey),
        code,
      );
      if (counter === null || counter === document.lastUsedCounter)
        return false;
      const updated = {
        ...document,
        enabled: enable ? true : document.enabled,
        lastUsedCounter: counter,
        updatedAt: new Date().toISOString(),
      };
      const committed = await this.redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], ARGV[2]); return 1 else return 0 end",
        [key],
        [JSON.stringify(document), JSON.stringify(updated)],
      );
      if (committed === 1) return true;
    }
    return false;
  }

  public async remove(userId: string, code: string) {
    if (!(await this.verify(userId, code))) return false;
    await this.redis.del(keyFor(userId));
    return true;
  }
}
