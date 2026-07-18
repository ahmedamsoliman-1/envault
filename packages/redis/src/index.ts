import { createClient } from "redis";

// Legacy namespace retained for data continuity after the Envault->Keep rebrand.
// Do NOT change: all existing keys (vaults, projects, environments, devices) use it.
export const KEEP_REDIS_PREFIX = "envault:v1";

export function keepRedisKey(...parts: string[]) {
  return [KEEP_REDIS_PREFIX, ...parts].join(":");
}

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface KeepRedis {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<number>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  /** Append an auto-ID entry to a stream, approx-trimming to `maxlenApprox`. */
  xadd(
    key: string,
    fields: Record<string, string>,
    options?: { maxlenApprox?: number },
  ): Promise<string>;
  /** Read entries in `[start, end]`, oldest first. Non-blocking. */
  xrange(
    key: string,
    start: string,
    end: string,
    count?: number,
  ): Promise<StreamEntry[]>;
  /** Read entries in `[start, end]`, newest first. Non-blocking. */
  xrevrange(
    key: string,
    start: string,
    end: string,
    count?: number,
  ): Promise<StreamEntry[]>;
}

let client: KeepRedis | null = null;

export function getKeepRedis(environment = process.env) {
  if (client) return client;
  const url = environment.REDIS_URL;
  if (!url) throw new Error("REDIS_CONFIGURATION_INCOMPLETE");

  const redis = createClient({ url });
  redis.on("error", (error) => {
    console.error("Redis connection error:", error);
  });

  let connection: Promise<unknown> | null = null;
  const connect = async () => {
    if (redis.isReady) return;
    connection ??= redis.connect().catch((error) => {
      connection = null;
      throw error;
    });
    await connection;
  };

  client = {
    async get<T>(key: string) {
      await connect();
      const value = await redis.get(key);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    },
    async set(key, value, options) {
      await connect();
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      return options?.ex
        ? redis.set(key, serialized, { EX: options.ex })
        : redis.set(key, serialized);
    },
    async del(key) {
      await connect();
      return redis.del(key);
    },
    async eval(script, keys, args) {
      await connect();
      return redis.eval(script, { keys, arguments: args });
    },
    async xadd(key, fields, options) {
      await connect();
      const trim = options?.maxlenApprox
        ? {
            TRIM: {
              strategy: "MAXLEN" as const,
              strategyModifier: "~" as const,
              threshold: options.maxlenApprox,
            },
          }
        : undefined;
      return redis.xAdd(key, "*", fields, trim);
    },
    async xrange(key, start, end, count) {
      await connect();
      const entries = await redis.xRange(
        key,
        start,
        end,
        count ? { COUNT: count } : undefined,
      );
      return entries.map((entry) => ({ id: entry.id, fields: entry.message }));
    },
    async xrevrange(key, start, end, count) {
      await connect();
      const entries = await redis.xRevRange(
        key,
        start,
        end,
        count ? { COUNT: count } : undefined,
      );
      return entries.map((entry) => ({ id: entry.id, fields: entry.message }));
    },
  };

  return client;
}
