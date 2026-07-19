"use client";

import { KeepClient } from "@keephq/api-client";
import type { PasswordItemDto } from "@keephq/api-contract";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { ActionDialog, ConfirmDialog } from "@/components/ui/action-dialog";
import {
  decryptPasswordEntry,
  emptyPasswordEntry,
  encryptPasswordEntry,
  type PasswordEntry,
} from "@/lib/password-entry";
import { getUserFacingError } from "@/lib/user-errors";
import {
  getActiveVaultKey,
  getVaultKeyState,
  lockedVaultKeyState,
  subscribeToVaultKey,
} from "@/lib/vault-key-store";

const client = new KeepClient({ baseUrl: "" });

interface Row {
  dto: PasswordItemDto;
  entry: PasswordEntry;
}

function byTitle(a: Row, b: Row) {
  return (
    a.entry.title.localeCompare(b.entry.title) ||
    a.entry.username.localeCompare(b.entry.username)
  );
}

export function PasswordWorkspace() {
  const vaultState = useSyncExternalStore(
    subscribeToVaultKey,
    getVaultKeyState,
    () => lockedVaultKeyState,
  );
  const unlocked = vaultState.unlocked && Boolean(vaultState.vaultId);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PasswordEntry>(emptyPasswordEntry());
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const load = useCallback(async () => {
    const vaultId = getVaultKeyState().vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) return;
    setLoading(true);
    try {
      const { items } = await client.passwords.list();
      const decrypted = await Promise.all(
        items.map(async (dto) => ({
          dto,
          entry: await decryptPasswordEntry(vaultKey, dto),
        })),
      );
      setRows(decrypted.sort(byTitle));
    } catch (caught) {
      toast.error(getUserFacingError(caught, "Passwords could not be loaded."));
    } finally {
      vaultKey.fill(0);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) {
      void load();
    } else {
      setRows([]);
      setRevealed(new Set());
    }
  }, [unlocked, load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(({ entry }) =>
      [entry.title, entry.url, entry.username]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyPasswordEntry());
    setFormOpen(true);
  }

  function openEdit(row: Row) {
    setEditingId(row.dto.id);
    setForm({ ...row.entry });
    setFormOpen(true);
  }

  async function copyValue(value: string, label: string) {
    if (!value) {
      toast.warning(`No ${label} to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`The ${label} could not be copied.`);
    }
  }

  function toggleReveal(id: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      toast.warning("A title is required.");
      return;
    }
    const vaultId = getVaultKeyState().vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) {
      toast.warning("Unlock the vault before saving passwords.");
      return;
    }
    setPending(true);
    try {
      const entry: PasswordEntry = { ...form, title };
      if (editingId) {
        const current = rows.find((row) => row.dto.id === editingId);
        if (!current) throw new Error("Password no longer exists.");
        const { encryptedData, encryptionIv } = await encryptPasswordEntry(
          vaultKey,
          vaultId,
          editingId,
          entry,
        );
        const result = await client.passwords.update(editingId, {
          encryptedData,
          encryptionIv,
          encryptionVersion: 1,
          expectedVersion: current.dto.version,
        });
        setRows((rowsNow) =>
          rowsNow
            .map((row) =>
              row.dto.id === editingId ? { dto: result.item, entry } : row,
            )
            .sort(byTitle),
        );
        toast.success("Password updated");
      } else {
        const id = crypto.randomUUID();
        const { encryptedData, encryptionIv } = await encryptPasswordEntry(
          vaultKey,
          vaultId,
          id,
          entry,
        );
        const result = await client.passwords.create({
          id,
          encryptedData,
          encryptionIv,
          encryptionVersion: 1,
        });
        setRows((rowsNow) =>
          [{ dto: result.item, entry }, ...rowsNow].sort(byTitle),
        );
        toast.success("Password encrypted and saved");
      }
      setFormOpen(false);
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The password could not be saved."),
      );
    } finally {
      vaultKey.fill(0);
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await client.passwords.delete(deleting.dto.id, deleting.dto.version);
      setRows((rowsNow) =>
        rowsNow.filter((row) => row.dto.id !== deleting.dto.id),
      );
      toast.success("Password deleted");
      setDeleting(null);
    } catch (caught) {
      toast.error(
        getUserFacingError(caught, "The password could not be deleted."),
      );
    } finally {
      setDeletePending(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-[var(--surface)] p-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
          <Lock className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Your vault is locked</h2>
        <p className="max-w-sm text-sm text-[var(--muted)]">
          Passwords are end-to-end encrypted. Unlock the vault from the header
          to view, add, and copy them. Keep never sees your passwords.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="w-full rounded-xl border bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, site, or username"
            value={search}
          />
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={openCreate}
          type="button"
        >
          <Plus className="size-4" />
          Add password
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Decrypting your vault…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-[var(--surface)] p-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
            <KeyRound className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">
            {rows.length === 0 ? "No passwords yet" : "No matches"}
          </h2>
          <p className="max-w-sm text-sm text-[var(--muted)]">
            {rows.length === 0
              ? "Add your first login to start building your source of truth."
              : "Try a different search."}
          </p>
          {rows.length === 0 ? (
            <button
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              onClick={openCreate}
              type="button"
            >
              <Plus className="size-4" />
              Add password
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => {
            const isRevealed = revealed.has(row.dto.id);
            return (
              <li
                className="flex flex-col gap-3 rounded-xl border bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
                key={row.dto.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {row.entry.title || "Untitled"}
                  </p>
                  <p className="truncate text-sm text-[var(--muted)]">
                    {row.entry.username || "—"}
                    {row.entry.url ? ` · ${row.entry.url}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {isRevealed ? row.entry.password || "—" : "••••••••••"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={isRevealed ? "Hide password" : "Show password"}
                    onClick={() => toggleReveal(row.dto.id)}
                  >
                    {isRevealed ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </IconButton>
                  <IconButton
                    label="Copy username"
                    onClick={() =>
                      void copyValue(row.entry.username, "username")
                    }
                  >
                    <span className="text-[11px] font-semibold">usr</span>
                  </IconButton>
                  <IconButton
                    label="Copy password"
                    onClick={() =>
                      void copyValue(row.entry.password, "password")
                    }
                  >
                    <Copy className="size-4" />
                  </IconButton>
                  <IconButton label="Edit" onClick={() => openEdit(row)}>
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    danger
                    label="Delete"
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ActionDialog
        onOpenChange={setFormOpen}
        open={formOpen}
        title={editingId ? "Edit password" : "Add password"}
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <Field
            label="Title"
            onChange={(value) => setForm((f) => ({ ...f, title: value }))}
            placeholder="GitHub"
            required
            value={form.title}
          />
          <Field
            label="Website"
            onChange={(value) => setForm((f) => ({ ...f, url: value }))}
            placeholder="https://github.com"
            value={form.url}
          />
          <Field
            label="Username or email"
            onChange={(value) => setForm((f) => ({ ...f, username: value }))}
            placeholder="octocat"
            value={form.username}
          />
          <Field
            label="Password"
            onChange={(value) => setForm((f) => ({ ...f, password: value }))}
            placeholder="••••••••"
            value={form.password}
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              className="min-h-20 w-full rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
              onChange={(event) =>
                setForm((f) => ({ ...f, notes: event.target.value }))
              }
              value={form.notes}
            />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <button
              className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
              onClick={() => setFormOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              {pending
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Save password"}
            </button>
          </div>
        </form>
      </ActionDialog>

      <ConfirmDialog
        confirmLabel="Delete"
        description={`Delete "${deleting?.entry.title || "this password"}"? This cannot be undone.`}
        destructive
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
        pending={deletePending}
        title="Delete password"
      />
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`flex size-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-hover)] ${
        danger ? "hover:text-red-600" : "hover:text-[var(--foreground)]"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}
