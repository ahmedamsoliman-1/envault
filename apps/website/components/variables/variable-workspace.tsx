"use client";

import { EnvaultClient } from "@envault/api-client";
import type { VariableDto } from "@envault/api-contract";
import { decryptVariableValue, encryptVariableValue } from "@envault/crypto";
import { getBrowserCryptoProvider } from "@envault/crypto/browser";
import { serializeDotenv } from "@envault/dotenv";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Pencil,
  Plus,
  Table2,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ActionDialog, ConfirmDialog } from "@/components/ui/action-dialog";
import { getUserFacingError } from "@/lib/user-errors";
import { getActiveVaultKey, getVaultKeyState } from "@/lib/vault-key-store";

const client = new EnvaultClient({ baseUrl: "" });

export function VariableWorkspace({
  environmentId,
  projectId,
}: {
  environmentId: string;
  projectId: string;
}) {
  const [variables, setVariables] = useState<VariableDto[]>([]);
  const [version, setVersion] = useState(0);
  const [creating, setCreating] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [visibility, setVisibility] =
    useState<VariableDto["visibility"]>("secret");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "dotenv">("table");
  const [dotenvContent, setDotenvContent] = useState<string | null>(null);
  const [dotenvLoading, setDotenvLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingVariable, setEditingVariable] = useState<VariableDto | null>(
    null,
  );
  const [deletingVariable, setDeletingVariable] = useState<VariableDto | null>(
    null,
  );
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    void client.variables
      .list(environmentId)
      .then((result) => {
        setVariables(result.variables);
        setVersion(result.version);
      })
      .catch((caught) =>
        setError(getUserFacingError(caught, "Variables could not be loaded.")),
      );
  }, [environmentId]);

  useEffect(
    () => () => {
      setDotenvContent(null);
    },
    [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const state = getVaultKeyState();
    const vaultKey = state.vaultId ? getActiveVaultKey(state.vaultId) : null;
    if (!state.vaultId || !vaultKey) {
      setError("Unlock the vault before adding a variable.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const payload = await encryptVariableValue(
        getBrowserCryptoProvider(),
        vaultKey,
        value,
        {
          vaultId: state.vaultId,
          projectId,
          environmentId,
          variableId: id,
          encryptionVersion: 1,
        },
      );
      vaultKey.fill(0);
      const result = await client.variables.create(environmentId, {
        id,
        projectId,
        key,
        encryptedValue: payload.ciphertext,
        encryptionIv: payload.iv,
        encryptionVersion: 1,
        visibility,
        tags: [],
        description: null,
        expectedVersion: version,
      });
      setVariables((current) => [result.variable, ...current]);
      setVersion(result.version);
      setKey("");
      setValue("");
      setCreating(false);
      toast.success("Variable encrypted and saved");
    } catch (caught) {
      setError(
        getUserFacingError(caught, "The variable could not be created."),
      );
    } finally {
      setPending(false);
    }
  }

  async function toggleReveal(variable: VariableDto) {
    if (revealed[variable.id]) {
      setRevealed((current) => {
        const next = { ...current };
        delete next[variable.id];
        return next;
      });
      return;
    }
    const vaultKey = getActiveVaultKey(variable.vaultId);
    if (!vaultKey) {
      setError("Unlock the vault before revealing secret values.");
      return;
    }
    try {
      const plaintext = await decryptVariableValue(
        getBrowserCryptoProvider(),
        vaultKey,
        {
          version: 1,
          algorithm: "AES-GCM",
          ciphertext: variable.encryptedValue,
          iv: variable.encryptionIv,
          additionalDataVersion: 1,
        },
        {
          vaultId: variable.vaultId,
          projectId: variable.projectId,
          environmentId: variable.environmentId,
          variableId: variable.id,
          encryptionVersion: variable.encryptionVersion,
        },
      );
      setRevealed((current) => ({ ...current, [variable.id]: plaintext }));
      window.setTimeout(() => {
        setRevealed((current) => {
          const next = { ...current };
          delete next[variable.id];
          return next;
        });
      }, 30_000);
    } catch {
      setError("This value could not be decrypted.");
    } finally {
      vaultKey.fill(0);
    }
  }

  async function editVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVariable || !editKey.trim()) return;
    const vaultKey = getActiveVaultKey(editingVariable.vaultId);
    if (!vaultKey) {
      setError("Unlock the vault before editing variables.");
      return;
    }
    setActionPending(true);
    try {
      const encrypted =
        editValue.length > 0
          ? await encryptVariableValue(
              getBrowserCryptoProvider(),
              vaultKey,
              editValue,
              {
                vaultId: editingVariable.vaultId,
                projectId: editingVariable.projectId,
                environmentId: editingVariable.environmentId,
                variableId: editingVariable.id,
                encryptionVersion: editingVariable.encryptionVersion,
              },
            )
          : null;
      const result = await client.variables.update(editingVariable.id, {
        expectedVersion: version,
        key: editKey.trim().toUpperCase(),
        ...(encrypted
          ? { encryptedValue: encrypted.ciphertext, encryptionIv: encrypted.iv }
          : {}),
      });
      setVariables((current) =>
        current.map((item) =>
          item.id === editingVariable.id ? result.variable : item,
        ),
      );
      setVersion(result.version);
      setRevealed((current) => {
        const next = { ...current };
        delete next[editingVariable.id];
        return next;
      });
      setEditingVariable(null);
      setEditValue("");
      toast.success("Variable updated");
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The variable could not be updated."),
      );
    } finally {
      vaultKey.fill(0);
      setActionPending(false);
    }
  }

  async function deleteVariable() {
    if (!deletingVariable) return;
    setActionPending(true);
    try {
      const result = await client.variables.delete(
        deletingVariable.id,
        version,
      );
      setVariables((current) =>
        current.filter((item) => item.id !== deletingVariable.id),
      );
      setVersion(result.version);
      setDeletingVariable(null);
      toast.success("Variable deleted");
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The variable could not be deleted."),
      );
    } finally {
      setActionPending(false);
    }
  }

  async function openDotenvView() {
    setView("dotenv");
    setDotenvLoading(true);
    setDotenvContent(null);
    setCopied(false);
    setError(null);

    const vaultId = variables[0]?.vaultId ?? getVaultKeyState().vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) {
      setError("Unlock the vault before generating a plaintext .env view.");
      setDotenvLoading(false);
      return;
    }

    try {
      const entries = await Promise.all(
        variables.map(async (variable) => ({
          key: variable.key,
          value: await decryptVariableValue(
            getBrowserCryptoProvider(),
            vaultKey,
            {
              version: 1,
              algorithm: "AES-GCM",
              ciphertext: variable.encryptedValue,
              iv: variable.encryptionIv,
              additionalDataVersion: 1,
            },
            {
              vaultId: variable.vaultId,
              projectId: variable.projectId,
              environmentId: variable.environmentId,
              variableId: variable.id,
              encryptionVersion: variable.encryptionVersion,
            },
          ),
        })),
      );
      setDotenvContent(serializeDotenv(entries));
    } catch {
      setError("The .env view could not be decrypted.");
      setView("table");
    } finally {
      vaultKey.fill(0);
      setDotenvLoading(false);
    }
  }

  function closeDotenvView() {
    setView("table");
    setDotenvContent(null);
    setCopied(false);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-xl border bg-[var(--surface)] p-1">
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              view === "table"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted)]"
            }`}
            onClick={closeDotenvView}
            type="button"
          >
            <Table2 className="size-4" />
            Table
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              view === "dotenv"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted)]"
            }`}
            onClick={() => void openDotenvView()}
            type="button"
          >
            <FileText className="size-4" />
            .env
          </button>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => setCreating(true)}
          type="button"
        >
          <Plus className="size-4" />
          Add variable
        </button>
      </div>
      {creating ? (
        <form
          className="mt-6 grid gap-4 rounded-2xl border bg-[var(--surface)] p-6 lg:grid-cols-[1fr_1.4fr_170px_auto]"
          onSubmit={(event) => void submit(event)}
        >
          <input
            className="rounded-xl border bg-transparent px-3.5 py-3 font-mono text-sm"
            onChange={(event) => setKey(event.target.value.toUpperCase())}
            placeholder="API_URL"
            required
            value={key}
          />
          <input
            className="rounded-xl border bg-transparent px-3.5 py-3 font-mono text-sm"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Secret value"
            required
            type="password"
            value={value}
          />
          <select
            className="rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm"
            onChange={(event) =>
              setVisibility(event.target.value as VariableDto["visibility"])
            }
            value={visibility}
          >
            <option value="secret">Secret</option>
            <option value="protected">Protected</option>
            <option value="plain">Plain</option>
          </select>
          <button
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            Add
          </button>
        </form>
      ) : null}
      {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}
      {view === "dotenv" ? (
        <section className="mt-8 overflow-hidden rounded-2xl border bg-[#101216] text-zinc-100">
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="font-mono text-sm font-medium">.env</p>
              <p className="mt-0.5 text-xs text-white/45">
                Decrypted locally · not sent to the server
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
              disabled={dotenvLoading || dotenvContent === null}
              onClick={() => {
                if (dotenvContent === null) return;
                void navigator.clipboard.writeText(dotenvContent);
                setCopied(true);
                toast.success(".env copied to clipboard");
                window.setTimeout(() => setCopied(false), 2_000);
              }}
              type="button"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy .env"}
            </button>
          </header>
          <pre className="min-h-64 overflow-x-auto whitespace-pre p-5 font-mono text-sm leading-7">
            {dotenvLoading
              ? "Decrypting environment…"
              : dotenvContent === ""
                ? "# This environment has no variables."
                : dotenvContent}
          </pre>
          <footer className="border-t border-white/10 px-4 py-3 text-xs text-white/40">
            Plaintext is cleared when you return to the table or leave this
            page.
          </footer>
        </section>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border bg-[var(--surface)]">
          <div className="grid min-w-[820px] grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_130px_120px] border-b px-5 py-3 text-xs font-medium uppercase text-[var(--muted)]">
            <span>Key</span>
            <span>Value</span>
            <span>Visibility</span>
            <span />
          </div>
          {variables.map((variable) => (
            <div
              className="grid min-w-[820px] grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_130px_120px] items-center border-b px-5 py-4 last:border-0"
              key={variable.id}
            >
              <code className="text-sm font-medium">{variable.key}</code>
              <code className="truncate pr-4 text-sm text-[var(--muted)]">
                {revealed[variable.id] ?? "••••••••••••••••"}
              </code>
              <span className="text-xs capitalize text-[var(--muted)]">
                {variable.visibility}
              </span>
              <div className="flex items-center">
                <button
                  aria-label={
                    revealed[variable.id] ? "Hide value" : "Reveal value"
                  }
                  className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                  onClick={() => void toggleReveal(variable)}
                  type="button"
                >
                  {revealed[variable.id] ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
                <button
                  aria-label="Edit variable"
                  className="rounded-lg p-2 hover:bg-[var(--surface-hover)]"
                  onClick={() => {
                    setEditingVariable(variable);
                    setEditKey(variable.key);
                    setEditValue("");
                  }}
                  type="button"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  aria-label="Delete variable"
                  className="rounded-lg p-2 text-red-600 hover:bg-red-500/10"
                  onClick={() => setDeletingVariable(variable)}
                  type="button"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          {variables.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-[var(--muted)]">
              No variables in this environment.
            </p>
          ) : null}
        </div>
      )}
      <ActionDialog
        description="Rename the key or provide a replacement value. Leave the value empty to preserve the existing ciphertext."
        footer={
          <>
            <button
              className="rounded-xl border px-4 py-2.5 text-sm font-medium"
              onClick={() => setEditingVariable(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={actionPending || !editKey.trim()}
              form="edit-variable-form"
              type="submit"
            >
              {actionPending ? "Saving…" : "Save changes"}
            </button>
          </>
        }
        onOpenChange={(open) => !open && setEditingVariable(null)}
        open={editingVariable !== null}
        title="Edit variable"
      >
        <form
          className="space-y-5"
          id="edit-variable-form"
          onSubmit={(event) => void editVariable(event)}
        >
          <label className="block text-sm font-medium">
            Key
            <input
              autoFocus
              className="mt-2 w-full rounded-xl border bg-transparent px-3.5 py-3 font-mono text-sm outline-none focus:border-indigo-500"
              onChange={(event) => setEditKey(event.target.value.toUpperCase())}
              value={editKey}
            />
          </label>
          <label className="block text-sm font-medium">
            Replacement value
            <input
              className="mt-2 w-full rounded-xl border bg-transparent px-3.5 py-3 font-mono text-sm outline-none focus:border-indigo-500"
              onChange={(event) => setEditValue(event.target.value)}
              placeholder="Leave empty to keep current value"
              type="password"
              value={editValue}
            />
          </label>
        </form>
      </ActionDialog>
      <ConfirmDialog
        confirmLabel="Delete variable"
        description={`This deletes ${deletingVariable?.key ?? "the variable"} and creates a final encrypted revision for recovery history.`}
        destructive
        onConfirm={() => void deleteVariable()}
        onOpenChange={(open) => !open && setDeletingVariable(null)}
        open={deletingVariable !== null}
        pending={actionPending}
        title="Delete variable?"
      />
    </div>
  );
}
