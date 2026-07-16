import { EnvaultApiError } from "@envault/api-client";
import { FirebaseError } from "firebase/app";

export type AuthOperation =
  | "login"
  | "register"
  | "password-reset"
  | "email-verification"
  | "mfa"
  | "session"
  | "logout";

const commonFirebaseMessages: Record<string, string> = {
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/weak-password":
    "Choose a stronger password with at least eight characters.",
  "auth/network-request-failed":
    "Envault could not reach the authentication service. Check your connection and try again.",
  "auth/too-many-requests":
    "Too many attempts were made. Wait a few minutes before trying again.",
  "auth/user-disabled": "This account is currently unavailable.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled. Contact the Envault administrator.",
  "auth/requires-recent-login":
    "For your security, sign in again before continuing.",
  "auth/invalid-verification-code":
    "The verification code is incorrect or has expired.",
  "auth/invalid-multi-factor-session":
    "The verification session expired. Start the setup again.",
  "auth/popup-closed-by-user":
    "The sign-in window was closed before authentication finished.",
};

const operationFallbacks: Record<AuthOperation, string> = {
  login: "The email or password is incorrect.",
  register: "Envault could not create an account with those details.",
  "password-reset":
    "If the account is eligible, password-reset instructions will be sent.",
  "email-verification":
    "The verification email could not be sent. Try again shortly.",
  mfa: "Authenticator-app verification could not be updated. Try again.",
  session: "Your secure session could not be established. Sign in again.",
  logout:
    "Envault could not finish signing out. Refresh the page and try again.",
};

export function getAuthErrorMessage(
  error: unknown,
  operation: AuthOperation,
): string {
  if (error instanceof EnvaultApiError) {
    if (error.status >= 500) {
      return "Firebase authentication succeeded, but Envault could not create its secure application session. Check the Redis configuration and try again.";
    }
    if (error.error.code === "UNAUTHENTICATED") {
      return operationFallbacks.session;
    }
    if (error.error.code === "FORBIDDEN") {
      return "This request was blocked for your security. Refresh the page and try again.";
    }
    return operationFallbacks[operation];
  }

  if (error instanceof FirebaseError) {
    if (error.code === "auth/operation-not-allowed" && operation === "mfa") {
      return "Authenticator-app MFA is not enabled for this Firebase project. Enable TOTP in Identity Platform and try again.";
    }
    const safeMessage = commonFirebaseMessages[error.code];
    if (safeMessage) return safeMessage;

    // These codes intentionally share one message to avoid disclosing account state.
    if (
      [
        "auth/invalid-credential",
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/email-already-in-use",
      ].includes(error.code)
    ) {
      return operationFallbacks[operation];
    }
  }

  return operationFallbacks[operation];
}
