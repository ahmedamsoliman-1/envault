"use client";

import { EnvaultApiError, EnvaultClient } from "@envault/api-client";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { getAuthErrorMessage } from "@/lib/auth-errors";
import { getClientAuth } from "@/lib/firebase-client";
import { isEmailVerificationRequired } from "@/lib/features";

type AuthMode = "login" | "register" | "forgot-password";

const apiClient = new EnvaultClient({ baseUrl: "" });

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const firebaseAuth = getClientAuth();
      if (pendingIdToken) {
        await apiClient.auth.session.create(
          pendingIdToken,
          mfaCode,
          rememberDevice,
        );
        setPendingIdToken(null);
        setMfaCode("");
        router.push("/app/dashboard");
        router.refresh();
        return;
      }

      if (mode === "forgot-password") {
        await sendPasswordResetEmail(firebaseAuth, email);
        toast.success(
          "If an account is eligible, password-reset instructions have been sent.",
        );
        return;
      }

      const credential =
        mode === "register"
          ? await createUserWithEmailAndPassword(firebaseAuth, email, password)
          : await signInWithEmailAndPassword(firebaseAuth, email, password);

      const verificationRequired = isEmailVerificationRequired();
      if (mode === "register" && verificationRequired) {
        await sendEmailVerification(credential.user);
      }

      const idToken = await credential.user.getIdToken(true);
      await apiClient.auth.session.create(idToken);

      if (verificationRequired && !credential.user.emailVerified) {
        router.push("/verify-email");
        return;
      }

      router.push("/app/dashboard");
      router.refresh();
    } catch (caughtError) {
      if (
        mode === "login" &&
        caughtError instanceof EnvaultApiError &&
        caughtError.error.code === "MFA_REQUIRED"
      ) {
        const currentUser = getClientAuth().currentUser;
        if (!currentUser) throw caughtError;
        setPendingIdToken(await currentUser.getIdToken(true));
        toast.info("Enter the code from your authenticator app to continue.");
        return;
      }
      await signOut(getClientAuth()).catch(() => undefined);
      toast.error(
        getAuthErrorMessage(
          caughtError,
          mode === "forgot-password" ? "password-reset" : mode,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <label className="block text-[13px] font-medium">
        Email
        <input
          autoComplete="email"
          className="focus:ring-3 mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-indigo-500/10"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      {mode !== "forgot-password" ? (
        pendingIdToken ? (
          <div className="space-y-4">
            <label className="block text-[13px] font-medium">
              Authenticator code
              <input
                autoComplete="one-time-code"
                autoFocus
                className="focus:ring-3 mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 font-mono text-sm tracking-[0.25em] outline-none focus:border-[var(--accent)] focus:ring-indigo-500/10"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setMfaCode(event.target.value.replace(/\D/gu, ""))
                }
                required
                value={mfaCode}
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--muted)]">
              <input
                checked={rememberDevice}
                className="mt-0.5 size-4 rounded border-[var(--border)] accent-indigo-600"
                onChange={(event) => setRememberDevice(event.target.checked)}
                type="checkbox"
              />
              <span>
                Trust this browser for 30 days
                <span className="mt-0.5 block text-xs">
                  Do not use this option on a shared device.
                </span>
              </span>
            </label>
          </div>
        ) : (
          <label className="block text-[13px] font-medium">
            Password
            <input
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              className="focus:ring-3 mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-indigo-500/10"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
        )
      ) : null}
      <button
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/15 hover:bg-indigo-500 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Please wait…"
          : pendingIdToken
            ? "Verify and sign in"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Send reset email"}
      </button>
    </form>
  );
}
