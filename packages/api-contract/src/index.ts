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
  "CLIPBOARD_DISABLED",
  "CLIPBOARD_ITEM_NOT_FOUND",
  "CLIPBOARD_PAYLOAD_TOO_LARGE",
  "CLIPBOARD_PINNED_LIMIT",
  "PASSWORDS_DISABLED",
  "PASSWORD_ITEM_NOT_FOUND",
  "PASSWORD_VERSION_CONFLICT",
  "DUPLICATE_PASSWORD",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const sessionExchangeRequestSchema = z.object({
  idToken: z.string().min(1),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/u)
    .optional(),
  rememberDevice: z.boolean().optional().default(false),
  passkeyProof: z.string().uuid().optional(),
});

export const mfaCodeRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/u),
});
export const mfaEnrollmentResponseSchema = z.object({
  secret: z.string().min(16),
  uri: z.url(),
});
export const mfaStatusSchema = z.object({ enabled: z.boolean() });

export const deviceScopeSchema = z.enum([
  "projects:read",
  "environments:read",
  "variables:read",
  "variables:write",
  "clipboard:read",
  "clipboard:write",
  "clipboard:receive",
  "passwords:read",
  "passwords:write",
]);
export const createDeviceAuthorizationRequestSchema = z.object({
  deviceName: z.string().trim().min(1).max(80),
  clientName: z.string().trim().min(1).max(80).default("Keep VS Code"),
  codeChallenge: z.string().min(43).max(128),
  scopes: z.array(deviceScopeSchema).min(1).max(12),
});
export const exchangeDeviceAuthorizationRequestSchema = z.object({
  codeVerifier: z.string().min(43).max(128),
});
export const approveDeviceAuthorizationRequestSchema = z.object({
  userCode: z.string().trim().min(6).max(16),
});
export const deviceAuthorizationResponseSchema = z.object({
  authorizationId: z.string().uuid(),
  userCode: z.string(),
  verificationUri: z.url(),
  expiresAt: z.iso.datetime(),
  intervalSeconds: z.number().int().positive(),
});
export const deviceSessionSchema = z.object({
  id: z.string().uuid(),
  deviceName: z.string(),
  clientName: z.string(),
  scopes: z.array(deviceScopeSchema),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.email().nullable(),
  displayName: z.string().nullable(),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
});

export const updateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
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

export const deviceWrappedVaultKeySchema = z.object({
  vaultId: z.string().min(1),
  wrappedKey: wrappedVaultKeyV1Schema,
});
export const deviceVaultKeyStatusSchema = z.object({
  wrapped: deviceWrappedVaultKeySchema.nullable(),
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

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().default(null),
});
export const updateProjectRequestSchema = createProjectRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const projectListSchema = z.object({
  projects: z.array(projectDtoSchema),
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

export const createEnvironmentRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: environmentKindSchema,
});
export const updateEnvironmentRequestSchema = createEnvironmentRequestSchema
  .partial()
  .extend({ expectedVersion: z.number().int().nonnegative() })
  .refine((value) => value.name !== undefined || value.kind !== undefined);

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

export const createVariableRequestSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().min(1),
  key: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/u)
    .max(256),
  encryptedValue: z.string().min(1).max(1_000_000),
  encryptionIv: z.string().min(1).max(256),
  encryptionVersion: z.literal(1),
  visibility: z.enum(["secret", "protected", "plain"]),
  tags: z.array(z.string().min(1).max(50)).max(30).default([]),
  description: z.string().max(1_000).nullable().default(null),
  expectedVersion: z.number().int().nonnegative(),
});
export const updateVariableRequestSchema = createVariableRequestSchema
  .omit({ id: true, projectId: true })
  .partial()
  .required({ expectedVersion: true });
export const deleteVersionRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export const importVariableItemSchema = createVariableRequestSchema.omit({
  expectedVersion: true,
});
export const importEnvironmentRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
    variables: z.array(importVariableItemSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    value.variables.forEach((variable, index) => {
      const normalizedKey = variable.key.toUpperCase();
      if (ids.has(variable.id)) {
        context.addIssue({
          code: "custom",
          message: "Variable IDs must be unique within an import chunk.",
          path: ["variables", index, "id"],
        });
      }
      if (keys.has(normalizedKey)) {
        context.addIssue({
          code: "custom",
          message: "Variable keys must be unique within an import chunk.",
          path: ["variables", index, "key"],
        });
      }
      ids.add(variable.id);
      keys.add(normalizedKey);
    });
  });
export const importEnvironmentResponseSchema = z.object({
  variables: z.array(variableDtoSchema),
  version: z.number().int().nonnegative(),
  replayed: z.boolean(),
});

export const bulkVariableUpdateSchema = z
  .object({
    id: z.string().min(1),
    key: createVariableRequestSchema.shape.key.optional(),
    visibility: variableDtoSchema.shape.visibility.optional(),
    tags: variableDtoSchema.shape.tags.optional(),
  })
  .refine(
    (value) =>
      value.key !== undefined ||
      value.visibility !== undefined ||
      value.tags !== undefined,
  );
export const bulkEnvironmentRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    expectedVersion: z.number().int().nonnegative(),
    updates: z.array(bulkVariableUpdateSchema).max(100).default([]),
    deleteIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .superRefine((value, context) => {
    if (value.updates.length + value.deleteIds.length === 0) {
      context.addIssue({
        code: "custom",
        message: "At least one bulk mutation is required.",
      });
    }
    const ids = [...value.updates.map(({ id }) => id), ...value.deleteIds];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Variables may only appear once in a bulk mutation.",
      });
    }
  });
export const bulkEnvironmentResponseSchema = z.object({
  variables: z.array(variableDtoSchema),
  deletedIds: z.array(z.string()),
  version: z.number().int().nonnegative(),
  replayed: z.boolean(),
});

export const clipboardContentTypeSchema = z.enum([
  "text",
  "url",
  "code",
  "json",
  "command",
]);
export const clipboardSensitivitySchema = z.enum([
  "normal",
  "sensitive",
  "secret",
]);
export const clipboardPersistenceModeSchema = z.enum([
  "once",
  "temporary",
  "pinned",
]);
export const clipboardOriginClientSchema = z.enum([
  "web",
  "vscode",
  "macos",
  "windows",
  "android",
  "ios",
]);

/** Metadata-only view used in list responses — never carries the content. */
export const clipboardItemDtoSchema = z.object({
  id: z.string().uuid(),
  contentType: clipboardContentTypeSchema,
  safePreview: z.string().nullable(),
  contentHash: z.string().min(1),
  byteLength: z.number().int().nonnegative(),
  sensitivity: clipboardSensitivitySchema,
  persistenceMode: clipboardPersistenceModeSchema,
  originClient: clipboardOriginClientSchema,
  language: z.string().nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  pinnedAt: z.iso.datetime().nullable(),
  consumedAt: z.iso.datetime().nullable(),
});

/** Detail view that additionally carries the plaintext content for copying. */
export const clipboardItemContentDtoSchema = clipboardItemDtoSchema.extend({
  content: z.string(),
});

export const createClipboardItemRequestSchema = z.object({
  content: z.string().min(1).max(1_048_576),
  contentType: clipboardContentTypeSchema.optional(),
  persistenceMode: clipboardPersistenceModeSchema.default("temporary"),
  originClient: clipboardOriginClientSchema.default("web"),
  language: z.string().trim().min(1).max(50).nullable().default(null),
  sensitivity: clipboardSensitivitySchema.optional(),
});

export const clipboardListSchema = z.object({
  items: z.array(clipboardItemDtoSchema),
});

/**
 * A password entry is encrypted client-side as one opaque blob (title, url,
 * username, password, notes, folder, tags, favorite all live inside the
 * ciphertext). The server stores and returns only ciphertext + identity +
 * per-item version, and learns nothing about the entry. Search and sort happen
 * in the browser after the vault is unlocked.
 */
export const passwordItemDtoSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().min(1),
  version: z.number().int().nonnegative(),
  encryptedData: z.string().min(1).max(1_000_000),
  encryptionIv: z.string().min(1).max(256),
  encryptionVersion: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createPasswordItemRequestSchema = z.object({
  id: z.string().uuid(),
  encryptedData: z.string().min(1).max(1_000_000),
  encryptionIv: z.string().min(1).max(256),
  encryptionVersion: z.literal(1),
});

export const updatePasswordItemRequestSchema = z.object({
  encryptedData: z.string().min(1).max(1_000_000),
  encryptionIv: z.string().min(1).max(256),
  encryptionVersion: z.literal(1),
  expectedVersion: z.number().int().nonnegative(),
});

export const passwordListSchema = z.object({
  items: z.array(passwordItemDtoSchema),
});

export const importPasswordItemSchema = createPasswordItemRequestSchema;
export const importPasswordsRequestSchema = z
  .object({
    operationId: z.string().uuid(),
    items: z.array(importPasswordItemSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.items.forEach((item, index) => {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Password IDs must be unique within an import chunk.",
          path: ["items", index, "id"],
        });
      }
      ids.add(item.id);
    });
  });
export const importPasswordsResponseSchema = z.object({
  items: z.array(passwordItemDtoSchema),
  replayed: z.boolean(),
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
export type DeviceScope = z.infer<typeof deviceScopeSchema>;
export type CreateDeviceAuthorizationRequest = z.infer<
  typeof createDeviceAuthorizationRequestSchema
>;
export type DeviceAuthorizationResponse = z.infer<
  typeof deviceAuthorizationResponseSchema
>;
export type DeviceSession = z.infer<typeof deviceSessionSchema>;
export type DeviceWrappedVaultKey = z.infer<typeof deviceWrappedVaultKeySchema>;
export type DeviceVaultKeyStatus = z.infer<typeof deviceVaultKeyStatusSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type CreateVaultRequest = z.infer<typeof createVaultRequestSchema>;
export type VaultDto = z.infer<typeof vaultDtoSchema>;
export type VaultStatus = z.infer<typeof vaultStatusSchema>;
export type VaultSettings = z.infer<typeof vaultSettingsSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type EnvironmentDto = z.infer<typeof environmentDtoSchema>;
export type CreateEnvironmentRequest = z.infer<
  typeof createEnvironmentRequestSchema
>;
export type UpdateEnvironmentRequest = z.infer<
  typeof updateEnvironmentRequestSchema
>;
export type VariableDto = z.infer<typeof variableDtoSchema>;
export type CreateVariableRequest = z.infer<typeof createVariableRequestSchema>;
export type UpdateVariableRequest = z.infer<typeof updateVariableRequestSchema>;
export type ImportVariableItem = z.infer<typeof importVariableItemSchema>;
export type ImportEnvironmentRequest = z.infer<
  typeof importEnvironmentRequestSchema
>;
export type ImportEnvironmentResponse = z.infer<
  typeof importEnvironmentResponseSchema
>;
export type BulkVariableUpdate = z.infer<typeof bulkVariableUpdateSchema>;
export type BulkEnvironmentRequest = z.infer<
  typeof bulkEnvironmentRequestSchema
>;
export type BulkEnvironmentResponse = z.infer<
  typeof bulkEnvironmentResponseSchema
>;
export type ClipboardContentType = z.infer<typeof clipboardContentTypeSchema>;
export type ClipboardSensitivity = z.infer<typeof clipboardSensitivitySchema>;
export type ClipboardPersistenceMode = z.infer<
  typeof clipboardPersistenceModeSchema
>;
export type ClipboardOriginClient = z.infer<typeof clipboardOriginClientSchema>;
export type ClipboardItemDto = z.infer<typeof clipboardItemDtoSchema>;
export type ClipboardItemContentDto = z.infer<
  typeof clipboardItemContentDtoSchema
>;
export type CreateClipboardItemRequest = z.input<
  typeof createClipboardItemRequestSchema
>;
export type ClipboardList = z.infer<typeof clipboardListSchema>;
export type PasswordItemDto = z.infer<typeof passwordItemDtoSchema>;
export type CreatePasswordItemRequest = z.infer<
  typeof createPasswordItemRequestSchema
>;
export type UpdatePasswordItemRequest = z.infer<
  typeof updatePasswordItemRequestSchema
>;
export type PasswordList = z.infer<typeof passwordListSchema>;
export type ImportPasswordItem = z.infer<typeof importPasswordItemSchema>;
export type ImportPasswordsRequest = z.infer<
  typeof importPasswordsRequestSchema
>;
export type ImportPasswordsResponse = z.infer<
  typeof importPasswordsResponseSchema
>;
