"use client";

import { EnvaultClient } from "@envault/api-client";
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  type User,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getClientAuth } from "@/lib/firebase-client";

const apiClient = new EnvaultClient({ baseUrl: "" });

export function VerificationPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => onAuthStateChanged(getClientAuth(), setUser), []);

  async function refreshStatus() {
    if (!user) {
      router.push("/login");
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await user.reload();
      if (!user.emailVerified) {
        setMessage("Your email is not verified yet.");
        return;
      }
      await apiClient.auth.session.create(await user.getIdToken(true));
      router.push("/app/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (!user) return;
    setPending(true);
    try {
      await sendEmailVerification(user);
      setMessage("A new verification email has been sent.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await apiClient.auth.session.delete().catch(() => undefined);
    await signOut(getClientAuth());
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="rounded-lg border px-3 py-3 text-sm">
        Signed in as <strong>{user?.email ?? "your account"}</strong>
      </p>
      {message ? (
        <p className="text-sm text-[var(--muted)]">{message}</p>
      ) : null}
      <button
        className="w-full rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          void refreshStatus();
        }}
        type="button"
      >
        Refresh verification status
      </button>
      <button
        className="w-full rounded-lg border px-4 py-2.5 text-sm disabled:opacity-50"
        disabled={pending || !user}
        onClick={() => {
          void resend();
        }}
        type="button"
      >
        Resend verification email
      </button>
      <button
        className="w-full px-4 py-2 text-sm text-[var(--muted)]"
        onClick={() => {
          void logout();
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
