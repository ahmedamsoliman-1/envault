import { EnvaultApiError } from "@envault/api-client";

const apiMessages: Partial<Record<EnvaultApiError["error"]["code"], string>> = {
  UNAUTHENTICATED: "Your session has expired. Sign in again to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  EMAIL_NOT_VERIFIED: "Verify your email address before continuing.",
  VAULT_LOCKED: "Unlock or create your vault before continuing.",
  VAULT_ALREADY_EXISTS: "A vault already exists for this account.",
  INVALID_REQUEST:
    "Some submitted information is invalid. Review it and try again.",
  ENVIRONMENT_VERSION_CONFLICT:
    "This environment changed in another session. Refresh before saving again.",
  MFA_REQUIRED: "Enter the code from your authenticator app to continue.",
  INVALID_MFA_CODE:
    "The authenticator code is invalid or has already been used.",
  FIRESTORE_UNAVAILABLE:
    "Envault could not reach its data service. Try again in a moment.",
};

export function getUserFacingError(error: unknown, fallback: string): string {
  if (error instanceof EnvaultApiError) {
    return apiMessages[error.error.code] ?? fallback;
  }
  return fallback;
}

export function getEnvironmentConflict(error: unknown) {
  if (
    !(error instanceof EnvaultApiError) ||
    error.error.code !== "ENVIRONMENT_VERSION_CONFLICT"
  ) {
    return null;
  }
  const details = error.error.details;
  return {
    expectedVersion:
      typeof details?.expectedVersion === "number"
        ? details.expectedVersion
        : null,
    currentVersion:
      typeof details?.currentVersion === "number"
        ? details.currentVersion
        : null,
  };
}
