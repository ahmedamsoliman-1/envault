"use client";

import { EnvaultApiError, EnvaultClient } from "@envault/api-client";
import type { VariableDto } from "@envault/api-contract";
import { decryptVariableValue, encryptVariableValue } from "@envault/crypto";
import { getBrowserCryptoProvider } from "@envault/crypto/browser";
import {
  serializeEnvironment,
  type DotenvEntry,
  type EnvironmentExportFormat,
} from "@envault/dotenv";
import {
  Check,
  Command,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Download,
  Pencil,
  Plus,
  Search,
  Table2,
  Tags,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ActionDialog, ConfirmDialog } from "@/components/ui/action-dialog";
import { VariableImportDialog } from "@/components/variables/variable-import-dialog";
import { getUserFacingError } from "@/lib/user-errors";
import { filterVariables, type ModifiedFilter } from "@/lib/variable-filters";
import { getActiveVaultKey, getVaultKeyState } from "@/lib/vault-key-store";

const client = new EnvaultClient({ baseUrl: "" });
type BulkAction =
  | "delete"
  | "visibility"
  | "add-tag"
  | "remove-tag"
  | "add-prefix"
  | "remove-prefix"
  | "uppercase";

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
  const [view, setView] = useState<"table" | "export">("table");
  const [dotenvContent, setDotenvContent] = useState<string | null>(null);
  const [exportEntries, setExportEntries] = useState<DotenvEntry[]>([]);
  const [exportFormat, setExportFormat] =
    useState<EnvironmentExportFormat>("dotenv");
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
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | VariableDto["visibility"]
  >("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [modifiedFilter, setModifiedFilter] = useState<ModifiedFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction>("visibility");
  const [bulkValue, setBulkValue] = useState("secret");
  const [bulkPending, setBulkPending] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredVariables = useMemo(() => {
    return filterVariables(variables, {
      search,
      visibility: visibilityFilter,
      tag: tagFilter,
      modified: modifiedFilter,
    });
  }, [modifiedFilter, search, tagFilter, variables, visibilityFilter]);

  const availableTags = useMemo(
    () =>
      [...new Set(variables.flatMap((variable) => variable.tags))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [variables],
  );

  useEffect(() => {
    void client.variables
      .list(environmentId)
      .then((result) => {
        setVariables(result.variables);
        setVersion(result.version);
      })
      .catch((caught) =>
        toast.error(
          getUserFacingError(caught, "Variables could not be loaded."),
        ),
      );
  }, [environmentId]);

  useEffect(
    () => () => {
      setDotenvContent(null);
      setExportEntries([]);
    },
    [],
  );

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (editing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreating(true);
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        void openDotenvView();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const state = getVaultKeyState();
    const vaultKey = state.vaultId ? getActiveVaultKey(state.vaultId) : null;
    if (!state.vaultId || !vaultKey) {
      toast.warning("Unlock the vault before adding a variable.");
      return;
    }
    setPending(true);
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
      toast.error(
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
      toast.warning("Unlock the vault before revealing secret values.");
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
      toast.error("This value could not be decrypted.");
    } finally {
      vaultKey.fill(0);
    }
  }

  async function editVariable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVariable || !editKey.trim()) return;
    const vaultKey = getActiveVaultKey(editingVariable.vaultId);
    if (!vaultKey) {
      toast.warning("Unlock the vault before editing variables.");
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

  async function executeBulkAction() {
    const selectedVariables = variables.filter((variable) =>
      selectedIds.has(variable.id),
    );
    if (selectedVariables.length === 0) return;

    const updates = selectedVariables.map((variable) => {
      switch (bulkAction) {
        case "visibility":
          return {
            id: variable.id,
            visibility: bulkValue as VariableDto["visibility"],
          };
        case "add-tag":
          return {
            id: variable.id,
            tags: [...new Set([...variable.tags, bulkValue.trim()])].slice(
              0,
              30,
            ),
          };
        case "remove-tag":
          return {
            id: variable.id,
            tags: variable.tags.filter((tag) => tag !== bulkValue.trim()),
          };
        case "add-prefix":
          return {
            id: variable.id,
            key: `${bulkValue.trim().toUpperCase()}${variable.key}`,
          };
        case "remove-prefix": {
          const prefix = bulkValue.trim().toUpperCase();
          return {
            id: variable.id,
            key: variable.key.startsWith(prefix)
              ? variable.key.slice(prefix.length)
              : variable.key,
          };
        }
        case "uppercase":
          return { id: variable.id, key: variable.key.toUpperCase() };
        case "delete":
          return { id: variable.id };
      }
    });

    if (bulkAction !== "delete") {
      const updateById = new Map(updates.map((update) => [update.id, update]));
      const finalKeys = variables.map(
        (variable) => updateById.get(variable.id)?.key ?? variable.key,
      );
      if (
        finalKeys.some((key) => !key) ||
        new Set(finalKeys.map((key) => key.toUpperCase())).size !==
          finalKeys.length
      ) {
        toast.error(
          "This transformation would create an empty or duplicate variable key.",
        );
        return;
      }
    }

    setBulkPending(true);
    let currentVersion = version;
    let currentVariables = [...variables];
    try {
      for (let index = 0; index < selectedVariables.length; index += 50) {
        const ids = new Set(
          selectedVariables.slice(index, index + 50).map(({ id }) => id),
        );
        const operationId = crypto.randomUUID();
        const request = {
          operationId,
          expectedVersion: currentVersion,
          updates:
            bulkAction === "delete"
              ? []
              : updates.filter((update) => ids.has(update.id)),
          deleteIds:
            bulkAction === "delete"
              ? selectedVariables
                  .filter((variable) => ids.has(variable.id))
                  .map(({ id }) => id)
              : [],
        };
        let result;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            result = await client.bulk.commit(environmentId, request);
            break;
          } catch (error) {
            const retryable =
              !(error instanceof EnvaultApiError) || error.status >= 500;
            if (!retryable || attempt === 1) throw error;
          }
        }
        if (!result) throw new Error("Bulk operation did not return a result.");
        currentVersion = result.version;
        const updatedById = new Map(
          result.variables.map((variable) => [variable.id, variable]),
        );
        const deleted = new Set(result.deletedIds);
        currentVariables = currentVariables
          .filter((variable) => !deleted.has(variable.id))
          .map((variable) => updatedById.get(variable.id) ?? variable);
      }
      setVariables(currentVariables);
      setVersion(currentVersion);
      setSelectedIds(new Set());
      setRevealed({});
      setBulkOpen(false);
      toast.success(
        `${selectedVariables.length} variable${selectedVariables.length === 1 ? "" : "s"} updated.`,
      );
    } catch (error) {
      setVariables(currentVariables);
      setVersion(currentVersion);
      toast.error(
        getUserFacingError(error, "The bulk operation could not be completed."),
      );
    } finally {
      setBulkPending(false);
    }
  }

  async function openDotenvView() {
    setView("export");
    setDotenvLoading(true);
    setDotenvContent(null);
    setCopied(false);

    const vaultId = variables[0]?.vaultId ?? getVaultKeyState().vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) {
      toast.warning(
        "Unlock the vault before generating a plaintext .env view.",
      );
      setView("table");
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
      setExportEntries(entries);
      setDotenvContent(serializeEnvironment(entries, "dotenv"));
    } catch {
      toast.error("The .env view could not be decrypted.");
      setView("table");
    } finally {
      vaultKey.fill(0);
      setDotenvLoading(false);
    }
  }

  function closeDotenvView() {
    setView("table");
    setDotenvContent(null);
    setExportEntries([]);
    setExportFormat("dotenv");
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
              view === "export"
                ? "bg-[var(--foreground)] text-[var(--background)]"
                : "text-[var(--muted)]"
            }`}
            onClick={() => void openDotenvView()}
            type="button"
          >
            <FileText className="size-4" />
            Export
          </button>
        </div>
        <div className="flex items-center gap-2">
          <VariableImportDialog
            environmentId={environmentId}
            onImported={(nextVariables, nextVersion) => {
              setVariables(nextVariables);
              setVersion(nextVersion);
              setRevealed({});
            }}
            projectId={projectId}
            variables={variables}
            version={version}
          />
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setCreating(true)}
            type="button"
          >
            <Plus className="size-4" />
            Add variable
          </button>
        </div>
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
          <select
            className="rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-sm"
            onChange={(event) => setTagFilter(event.target.value)}
            value={tagFilter}
          >
            <option value="all">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-sm"
            onChange={(event) =>
              setModifiedFilter(event.target.value as ModifiedFilter)
            }
            value={modifiedFilter}
          >
            <option value="all">Any modification date</option>
            <option value="today">Modified today</option>
            <option value="week">Modified this week</option>
            <option value="month">Modified this month</option>
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
      {view === "table" ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              ref={searchInputRef}
              className="w-full rounded-xl border bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search keys or tags"
              type="search"
              value={search}
            />
          </div>
          <select
            className="rounded-xl border bg-[var(--surface)] px-3.5 py-2.5 text-sm"
            onChange={(event) =>
              setVisibilityFilter(
                event.target.value as "all" | VariableDto["visibility"],
              )
            }
            value={visibilityFilter}
          >
            <option value="all">All visibility</option>
            <option value="secret">Secret</option>
            <option value="protected">Protected</option>
            <option value="plain">Plain</option>
          </select>
          {selectedIds.size > 0 ? (
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
              onClick={() => setBulkOpen(true)}
              type="button"
            >
              <Tags className="size-4" />
              Bulk actions ({selectedIds.size})
            </button>
          ) : null}
          <button
            aria-label="Open command palette"
            className="inline-flex items-center justify-center gap-2 rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)]"
            onClick={() => setCommandOpen(true)}
            type="button"
          >
            <Command className="size-4" />
            <span className="hidden xl:inline">⇧⌘K</span>
          </button>
        </div>
      ) : null}
      {view === "export" ? (
        <section className="mt-8 overflow-hidden rounded-2xl border bg-[#101216] text-zinc-100">
          <header className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm font-medium">
                Local environment export
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                Decrypted locally · not sent to the server
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none"
                disabled={dotenvLoading || exportEntries.length === 0}
                onChange={(event) => {
                  const format = event.target.value as EnvironmentExportFormat;
                  setExportFormat(format);
                  setDotenvContent(
                    serializeEnvironment(exportEntries, format, {
                      kubernetesSecretName: `envault-${environmentId}`,
                    }),
                  );
                  setCopied(false);
                }}
                value={exportFormat}
              >
                <option className="text-black" value="dotenv">
                  .env
                </option>
                <option className="text-black" value="json">
                  JSON
                </option>
                <option className="text-black" value="shell">
                  Shell exports
                </option>
                <option className="text-black" value="docker-compose">
                  Docker Compose
                </option>
                <option className="text-black" value="kubernetes-secret">
                  Kubernetes Secret
                </option>
              </select>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
                disabled={dotenvLoading || dotenvContent === null}
                onClick={() => {
                  if (dotenvContent === null) return;
                  void navigator.clipboard
                    .writeText(dotenvContent)
                    .then(() => {
                      setCopied(true);
                      toast.success("Export copied to clipboard.");
                      window.setTimeout(() => setCopied(false), 2_000);
                    })
                    .catch(() =>
                      toast.error("The export could not be copied."),
                    );
                }}
                type="button"
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10 disabled:opacity-40"
                disabled={dotenvLoading || dotenvContent === null}
                onClick={() => {
                  if (dotenvContent === null) return;
                  const extensions: Record<EnvironmentExportFormat, string> = {
                    dotenv: ".env",
                    json: ".json",
                    shell: ".sh",
                    "docker-compose": ".compose.yaml",
                    "kubernetes-secret": ".secret.yaml",
                  };
                  const blob = new Blob([dotenvContent], {
                    type: "text/plain;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `envault-${environmentId}${extensions[exportFormat]}`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                  toast.success("Export downloaded.");
                }}
                type="button"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </header>
          <pre className="min-h-64 overflow-x-auto whitespace-pre p-5 font-mono text-sm leading-7">
            {dotenvLoading
              ? "Decrypting environment…"
              : dotenvContent === ""
                ? "# This environment has no variables."
                : dotenvContent}
          </pre>
          <footer className="border-t border-white/10 px-4 py-3 text-xs text-white/40">
            {exportFormat === "kubernetes-secret"
              ? "Kubernetes values are base64 encoded, not encrypted. "
              : ""}
            Plaintext is cleared when you return to the table or leave this
            page.
          </footer>
        </section>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border bg-[var(--surface)]">
          <div className="grid min-w-[860px] grid-cols-[40px_minmax(180px,1fr)_minmax(220px,1.4fr)_130px_120px] border-b px-5 py-3 text-xs font-medium uppercase text-[var(--muted)]">
            <input
              aria-label="Select all visible variables"
              checked={
                filteredVariables.length > 0 &&
                filteredVariables.every((variable) =>
                  selectedIds.has(variable.id),
                )
              }
              onChange={(event) => {
                setSelectedIds((current) => {
                  const next = new Set(current);
                  for (const variable of filteredVariables) {
                    if (event.target.checked) next.add(variable.id);
                    else next.delete(variable.id);
                  }
                  return next;
                });
              }}
              type="checkbox"
            />
            <span>Key</span>
            <span>Value</span>
            <span>Visibility</span>
            <span />
          </div>
          {filteredVariables.map((variable) => (
            <div
              className="grid min-w-[860px] grid-cols-[40px_minmax(180px,1fr)_minmax(220px,1.4fr)_130px_120px] items-center border-b px-5 py-4 last:border-0"
              key={variable.id}
            >
              <input
                aria-label={`Select ${variable.key}`}
                checked={selectedIds.has(variable.id)}
                onChange={(event) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(variable.id);
                    else next.delete(variable.id);
                    return next;
                  });
                }}
                type="checkbox"
              />
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
          {filteredVariables.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-[var(--muted)]">
              {variables.length === 0
                ? "No variables in this environment."
                : "No variables match the current search and filters."}
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
      <ActionDialog
        description="Quick actions for the current environment. Shortcuts work when you are not typing in a field."
        onOpenChange={setCommandOpen}
        open={commandOpen}
        title="Environment commands"
      >
        <div className="space-y-2">
          {[
            {
              label: "Add a variable",
              shortcut: "N",
              action: () => setCreating(true),
            },
            {
              label: "Search variables",
              shortcut: "/",
              action: () => searchInputRef.current?.focus(),
            },
            {
              label: "Open local exports",
              shortcut: "E",
              action: () => void openDotenvView(),
            },
            {
              label: "Select visible variables",
              shortcut: "",
              action: () =>
                setSelectedIds(
                  new Set(filteredVariables.map((variable) => variable.id)),
                ),
            },
            ...(selectedIds.size > 0
              ? [
                  {
                    label: `Bulk actions for ${selectedIds.size} selected`,
                    shortcut: "",
                    action: () => setBulkOpen(true),
                  },
                ]
              : []),
          ].map((command) => (
            <button
              className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-[var(--surface-hover)]"
              key={command.label}
              onClick={() => {
                setCommandOpen(false);
                command.action();
              }}
              type="button"
            >
              {command.label}
              {command.shortcut ? (
                <kbd className="rounded border px-2 py-1 text-[10px] text-[var(--muted)]">
                  {command.shortcut}
                </kbd>
              ) : null}
            </button>
          ))}
        </div>
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
      <ActionDialog
        description={`Apply one operation to ${selectedIds.size} selected variable${selectedIds.size === 1 ? "" : "s"}. Changes are version checked and retry safe.`}
        footer={
          <>
            <button
              className="rounded-xl border px-4 py-2.5 text-sm font-medium"
              onClick={() => setBulkOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                bulkAction === "delete" ? "bg-red-600" : "bg-indigo-600"
              }`}
              disabled={
                bulkPending ||
                ([
                  "add-tag",
                  "remove-tag",
                  "add-prefix",
                  "remove-prefix",
                ].includes(bulkAction) &&
                  !bulkValue.trim())
              }
              onClick={() => void executeBulkAction()}
              type="button"
            >
              {bulkPending ? "Applying…" : "Apply bulk action"}
            </button>
          </>
        }
        onOpenChange={setBulkOpen}
        open={bulkOpen}
        title="Bulk variable operation"
      >
        <div className="space-y-5">
          <label className="block text-sm font-medium">
            Action
            <select
              className="mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm"
              onChange={(event) => {
                const action = event.target.value as BulkAction;
                setBulkAction(action);
                setBulkValue(action === "visibility" ? "secret" : "");
              }}
              value={bulkAction}
            >
              <option value="visibility">Change visibility</option>
              <option value="add-tag">Add tag</option>
              <option value="remove-tag">Remove tag</option>
              <option value="add-prefix">Add key prefix</option>
              <option value="remove-prefix">Remove key prefix</option>
              <option value="uppercase">Convert keys to uppercase</option>
              <option value="delete">Delete variables</option>
            </select>
          </label>
          {bulkAction === "visibility" ? (
            <label className="block text-sm font-medium">
              Visibility
              <select
                className="mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm"
                onChange={(event) => setBulkValue(event.target.value)}
                value={bulkValue}
              >
                <option value="secret">Secret</option>
                <option value="protected">Protected</option>
                <option value="plain">Plain</option>
              </select>
            </label>
          ) : ["add-tag", "remove-tag", "add-prefix", "remove-prefix"].includes(
              bulkAction,
            ) ? (
            <label className="block text-sm font-medium">
              {bulkAction.includes("tag") ? "Tag" : "Prefix"}
              <input
                autoFocus
                className="mt-2 w-full rounded-xl border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-indigo-500"
                maxLength={50}
                onChange={(event) => setBulkValue(event.target.value)}
                value={bulkValue}
              />
            </label>
          ) : bulkAction === "delete" ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-700">
              Selected variables will be deleted and encrypted recovery
              revisions will be created.
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Keys will be normalized to uppercase after collision checks.
            </p>
          )}
        </div>
      </ActionDialog>
    </div>
  );
}
