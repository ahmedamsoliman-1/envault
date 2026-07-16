import "server-only";

import { z } from "zod";

const serverEnvironmentSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((value) => value.replaceAll("\\n", "\n")),
  SESSION_COOKIE_NAME: z.string().min(1).default("envault_session"),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(432_000),
  DEVICE_AUTHORIZATION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(600),
  DEVICE_SESSION_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2_592_000),
  VAULT_PBKDF2_ITERATIONS: z.coerce.number().int().min(600_000),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
