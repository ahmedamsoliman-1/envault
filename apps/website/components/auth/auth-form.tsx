"use client";

import { EnvaultClient } from "@envault/api-client";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getClientAuth } from "@/lib/firebase-client";
import { isEmailVerificationRequired } from "@/lib/features";

type AuthMode = "login" | "register" | "forgot-password";

const apiClient = new EnvaultClient({ baseUrl: "" });

function getMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/^Firebase:\s*/u, "");
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      const firebaseAuth = getClientAuth();
      if (mode === "forgot-password") {
        await sendPasswordResetEmail(firebaseAuth, email);
        setNotice(
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
      await signOut(getClientAuth()).catch(() => undefined);
      setError(getMessage(caughtError));
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
      <label className="block text-sm font-medium">
        Email
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      {mode !== "forgot-password" ? (
        <label className="block text-sm font-medium">
          Password
          <input
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border px-3 py-2 text-sm text-[var(--muted)]">
          {notice}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : mode === "register"
              ? "Create account"
              : "Send reset email"}
      </button>
    </form>
  );
}
