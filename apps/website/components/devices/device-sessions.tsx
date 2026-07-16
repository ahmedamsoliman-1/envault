"use client";

import { EnvaultClient } from "@envault/api-client";
import type { DeviceSession } from "@envault/api-contract";
import { Laptop, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/action-dialog";

const client = new EnvaultClient({ baseUrl: "" });

export function DeviceSessions() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [removing, setRemoving] = useState<DeviceSession | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void client.devices
      .listSessions()
      .then(setSessions)
      .catch(() => undefined);
  }, []);

  async function revoke() {
    if (!removing) return;
    setPending(true);
    try {
      await client.devices.revokeSession(removing.id);
      setSessions((current) => current.filter(({ id }) => id !== removing.id));
      setRemoving(null);
      toast.success("Device access revoked.");
    } catch {
      toast.error("The device session could not be revoked.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border bg-[var(--surface)] p-6">
        <div className="flex gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
            <Laptop className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">Authorized devices</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Review and revoke VS Code and future integration sessions.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <div
              className="flex items-center justify-between gap-4 rounded-xl border p-4"
              key={session.id}
            >
              <div>
                <p className="text-sm font-medium">{session.deviceName}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {session.clientName} · expires{" "}
                  {new Date(session.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <button
                aria-label={`Revoke ${session.deviceName}`}
                className="rounded-lg p-2 text-red-600 hover:bg-red-500/10"
                onClick={() => setRemoving(session)}
                type="button"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {!sessions.length ? (
            <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-[var(--muted)]">
              No external devices are authorized.
            </p>
          ) : null}
        </div>
      </section>
      <ConfirmDialog
        confirmLabel="Revoke access"
        description={`Revoke access for ${removing?.deviceName ?? "this device"}? It will need browser approval before connecting again.`}
        destructive
        onConfirm={() => void revoke()}
        onOpenChange={(open) => {
          if (!open && !pending) setRemoving(null);
        }}
        open={removing !== null}
        pending={pending}
        title="Revoke device"
      />
    </>
  );
}
