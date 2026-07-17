import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Keep"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_ENABLE_APP_CHECK: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NEXT_PUBLIC_KEEP_CLIPBOARD_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parsePublicEnvironment(
  environment: Record<string, string | undefined>,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}
