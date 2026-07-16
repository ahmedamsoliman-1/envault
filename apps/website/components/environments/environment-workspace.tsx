"use client";

import { EnvaultClient } from "@envault/api-client";
import type { EnvironmentDto } from "@envault/api-contract";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ActionDialog, ConfirmDialog } from "@/components/ui/action-dialog";
import { getUserFacingError } from "@/lib/user-errors";

const client = new EnvaultClient({ baseUrl: "" });

export function EnvironmentWorkspace({ projectId }: { projectId: string }) {
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EnvironmentDto["kind"]>("development");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingEnvironment, setEditingEnvironment] =
    useState<EnvironmentDto | null>(null);
  const [deletingEnvironment, setDeletingEnvironment] =
    useState<EnvironmentDto | null>(null);
  const [editName, setEditName] = useState("");
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    void client.environments
      .list(projectId)
      .then((result) => setEnvironments(result.environments))
      .catch((caught) =>
        setError(
          getUserFacingError(caught, "Environments could not be loaded."),
        ),
      );
  }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const environment = await client.environments.create(projectId, {
        name,
        kind,
      });
      setEnvironments((current) => [environment, ...current]);
      setName("");
      setCreating(false);
      toast.success("Environment created");
    } catch (caught) {
      setError(
        getUserFacingError(caught, "The environment could not be created."),
      );
    } finally {
      setPending(false);
    }
  }

  async function editEnvironment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEnvironment || !editName.trim()) return;
    setActionPending(true);
    try {
      const updated = await client.environments.update(editingEnvironment.id, {
        name: editName.trim(),
        expectedVersion: editingEnvironment.version,
      });
      setEnvironments((current) =>
        current.map((item) =>
          item.id === editingEnvironment.id ? updated : item,
        ),
      );
      setEditingEnvironment(null);
      toast.success("Environment updated");
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The environment could not be updated."),
      );
    } finally {
      setActionPending(false);
    }
  }

  async function deleteEnvironment() {
    if (!deletingEnvironment) return;
    setActionPending(true);
    try {
      await client.environments.delete(
        deletingEnvironment.id,
        deletingEnvironment.version,
      );
      setEnvironments((current) =>
        current.filter((item) => item.id !== deletingEnvironment.id),
      );
      setDeletingEnvironment(null);
      toast.success("Environment deleted");
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The environment could not be deleted."),
      );
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setCreating(true)}
          type="button"
        >
          <Plus className="size-4" />
          New environment
        </button>
      </div>
      {creating ? (
        <form
          className="mt-6 grid gap-4 rounded-2xl border bg-[var(--surface)] p-6 md:grid-cols-[1fr_220px_auto]"
          onSubmit={(event) => void submit(event)}
        >
          <input
            className="rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-indigo-500"
            onChange={(event) => setName(event.target.value)}
            placeholder="Staging"
            required
            value={name}
          />
          <select
            className="rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm"
            onChange={(event) =>
              setKind(event.target.value as EnvironmentDto["kind"])
            }
            value={kind}
          >
            {[
              "local",
              "development",
              "testing",
              "staging",
              "production",
              "custom",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            Create
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {environments.map((environment) => (
          <article
            className="rounded-2xl border bg-[var(--surface)] p-5 hover:border-indigo-500/35"
            key={environment.id}
          >
            <Boxes className="size-5 text-indigo-500" />
            <div className="mt-5 flex items-center justify-between">
              <Link
                className="font-semibold hover:text-indigo-600"
                href={`/app/environments/${environment.id}?projectId=${projectId}`}
              >
                {environment.name}
              </Link>
              <span className="rounded-full bg-[var(--app-background)] px-2.5 py-1 text-[11px] capitalize text-[var(--muted)]">
                {environment.kind}
              </span>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Version {environment.version}
            </p>
            <div className="mt-4 flex gap-1 border-t pt-3">
              <button
                className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)]"
                onClick={() => {
                  setEditingEnvironment(environment);
                  setEditName(environment.name);
                }}
                type="button"
              >
                <Pencil className="size-3.5" />
                Rename
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-red-600 hover:bg-red-500/10"
                onClick={() => setDeletingEnvironment(environment)}
                type="button"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {environments.length === 0 && !creating ? (
        <div className="mt-8 rounded-2xl border border-dashed p-14 text-center">
          <Boxes className="mx-auto size-6 text-[var(--muted)]" />
          <p className="mt-4 text-sm font-medium">No environments yet</p>
        </div>
      ) : null}
      <ActionDialog
        description="Rename this environment without changing its encrypted variables."
        footer={
          <>
            <button
              className="rounded-xl border px-4 py-2.5 text-sm font-medium"
              onClick={() => setEditingEnvironment(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={actionPending || !editName.trim()}
              form="edit-environment-form"
              type="submit"
            >
              {actionPending ? "Saving…" : "Save changes"}
            </button>
          </>
        }
        onOpenChange={(open) => !open && setEditingEnvironment(null)}
        open={editingEnvironment !== null}
        title="Rename environment"
      >
        <form
          id="edit-environment-form"
          onSubmit={(event) => void editEnvironment(event)}
        >
          <label className="text-sm font-medium">
            Environment name
            <input
              autoFocus
              className="mt-2 w-full rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-indigo-500"
              onChange={(event) => setEditName(event.target.value)}
              value={editName}
            />
          </label>
        </form>
      </ActionDialog>
      <ConfirmDialog
        confirmLabel="Delete environment"
        description={`This permanently deletes “${deletingEnvironment?.name ?? ""}” and all variables inside it. This action cannot be undone.`}
        destructive
        onConfirm={() => void deleteEnvironment()}
        onOpenChange={(open) => !open && setDeletingEnvironment(null)}
        open={deletingEnvironment !== null}
        pending={actionPending}
        title="Delete environment?"
      />
    </div>
  );
}
