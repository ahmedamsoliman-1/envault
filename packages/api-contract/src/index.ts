import { z } from "zod";

export const requestMetaSchema = z.object({
  requestId: z.string().min(1),
});

export const apiErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "EMAIL_NOT_VERIFIED",
  "MFA_REQUIRED",
  "INVALID_MFA_CODE",
  "RECENT_AUTHENTICATION_REQUIRED",
  "VAULT_LOCKED",
  "VAULT_ALREADY_EXISTS",
  "INCORRECT_VAULT_PASSPHRASE",
  "INVALID_RECOVERY_KEY",
  "CORRUPT_CIPHERTEXT",
  "UNSUPPORTED_ENCRYPTION_VERSION",
  "INVALID_REQUEST",
  "DUPLICATE_VARIABLE",
  "ENVIRONMENT_VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "IMPORT_PARSE_ERROR",
  "PARTIAL_BULK_OPERATION_FAILURE",
  "DEVICE_AUTHORIZATION_EXPIRED",
  "DEVICE_AUTHORIZATION_ALREADY_USED",
  "DEVICE_SESSION_REVOKED",
  "FIRESTORE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const sessionExchangeRequestSchema = z.object({
  idToken: z.string().min(1),
});

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.email().nullable(),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
});

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  expiresAt: z.iso.datetime(),
});

export const keyDerivationV1Schema = z.object({
  version: z.literal(1),
  algorithm: z.literal("PBKDF2-SHA-256"),
  salt: z.string().min(16).max(256),
  iterations: z.number().int().min(600_000).max(10_000_000),
});

export const wrappedVaultKeyV1Schema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-GCM"),
  ciphertext: z.string().min(32).max(1_024),
  iv: z.string().min(12).max(128),
  additionalDataVersion: z.literal(1),
});

export const createVaultRequestSchema = z.object({
  vaultId: z.string().uuid(),
  protocolVersion: z.literal(1),
  passphraseDerivation: keyDerivationV1Schema,
  passphraseWrappedKey: wrappedVaultKeyV1Schema,
  recoveryDerivation: keyDerivationV1Schema,
  recoveryWrappedKey: wrappedVaultKeyV1Schema,
  autoLockMinutes: z.number().int().min(1).max(1_440).default(15),
});

export const vaultDtoSchema = createVaultRequestSchema.extend({
  ownerId: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const vaultStatusSchema = z.object({
  exists: z.boolean(),
  vault: vaultDtoSchema.nullable(),
});

export const vaultSettingsSchema = z.object({
  pbkdf2Iterations: z.number().int().min(600_000).max(10_000_000),
});

export const projectDtoSchema = z.object({
  id: z.string().min(1),
  vaultId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const environmentKindSchema = z.enum([
  "local",
  "development",
  "testing",
  "staging",
  "production",
  "custom",
]);

export const environmentDtoSchema = z.object({
  id: z.string().min(1),
  vaultId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  kind: environmentKindSchema,
  version: z.number().int().nonnegative(),
  contentRevision: z.string().min(1),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const variableDtoSchema = z.object({
  id: z.string().min(1),
  vaultId: z.string().min(1),
  projectId: z.string().min(1),
  environmentId: z.string().min(1),
  key: z.string().min(1).max(256),
  encryptedValue: z.string().min(1).max(1_000_000),
  encryptionIv: z.string().min(1).max(256),
  encryptionVersion: z.number().int().positive(),
  visibility: z.enum(["secret", "protected", "plain"]),
  tags: z.array(z.string().min(1).max(50)).max(30),
  description: z.string().max(1_000).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export function createSuccessResponse<T>(data: T, requestId: string) {
  return { data, meta: { requestId } };
}

export function createErrorResponse(
  error: z.infer<typeof apiErrorSchema>,
  requestId: string,
) {
  return { error, meta: { requestId } };
}

export type ApiError = z.infer<typeof apiErrorSchema>;
export type SessionExchangeRequest = z.infer<
  typeof sessionExchangeRequestSchema
>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type CreateVaultRequest = z.infer<typeof createVaultRequestSchema>;
export type VaultDto = z.infer<typeof vaultDtoSchema>;
export type VaultStatus = z.infer<typeof vaultStatusSchema>;
export type VaultSettings = z.infer<typeof vaultSettingsSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type EnvironmentDto = z.infer<typeof environmentDtoSchema>;
export type VariableDto = z.infer<typeof variableDtoSchema>;
