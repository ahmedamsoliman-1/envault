"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function DeviceApproval({
  authorizationId,
  userCode,
  deviceName,
  clientName,
  scopes,
}: {
  authorizationId: string;
  userCode: string;
  deviceName: string;
  clientName: string;
  scopes: string[];
}) {
  const [pending, setPending] = useState(false);
  const [approved, setApproved] = useState(false);

  async function approve() {
    setPending(true);
    try {
      const response = await fetch(
        `/api/v1/device-authorizations/${authorizationId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userCode }),
        },
      );
      if (!response.ok) throw new Error("Device approval failed.");
      setApproved(true);
      toast.success("Device approved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Device approval failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border bg-[var(--surface)] p-7">
      <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
        <ShieldCheck className="size-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold">
        {approved ? "Device approved" : "Approve a new device"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        {approved
          ? `Return to ${clientName}. Keep will finish creating its revocable device session.`
          : `${clientName} is requesting access from ${deviceName}.`}
      </p>
      {!approved ? (
        <>
          <div className="mt-6 rounded-xl border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Requested permissions
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {scopes.map((scope) => (
                <li key={scope}>• {scope.replace(":", " ")}</li>
              ))}
            </ul>
          </div>
          <div className="mt-5 rounded-xl bg-[var(--surface-hover)] p-4">
            <p className="text-xs text-[var(--muted)]">Verification code</p>
            <code className="mt-1 block text-lg font-semibold tracking-wider">
              {userCode}
            </code>
          </div>
          <button
            className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={pending}
            onClick={() => void approve()}
            type="button"
          >
            {pending ? "Approving…" : "Approve device"}
          </button>
        </>
      ) : null}
    </section>
  );
}
