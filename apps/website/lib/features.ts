export function isEmailVerificationRequired() {
  return process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";
}

export function isClipboardEnabled() {
  return process.env.NEXT_PUBLIC_KEEP_CLIPBOARD_ENABLED === "true";
}

export function isPasswordsEnabled() {
  return process.env.NEXT_PUBLIC_KEEP_PASSWORDS_ENABLED === "true";
}
