"use client";

import { EnvaultApiError, EnvaultClient } from "@envault/api-client";
import type { ImportVariableItem, VariableDto } from "@envault/api-contract";
import { decryptVariableValue, encryptVariableValue } from "@envault/crypto";
import { getBrowserCryptoProvider } from "@envault/crypto/browser";
import {
  parseDotenv,
  type DotenvDiagnostic,
  type ParsedDotenvEntry,
} from "@envault/dotenv";
import { FileUp, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ActionDialog } from "@/components/ui/action-dialog";
import { getActiveVaultKey, getVaultKeyState } from "@/lib/vault-key-store";
import { getUserFacingError } from "@/lib/user-errors";

const client = new EnvaultClient({ baseUrl: "" });
const apiKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;

type ImportClassification =
  "new" | "updated" | "unchanged" | "invalid" | "conflicting";
type ImportPolicy = "overwrite" | "skip-existing" | "new-only";

interface PreviewItem {
  id: string;
  entry: ParsedDotenvEntry;
  classification: ImportClassification;
  existing: VariableDto | null;
}

const classificationStyles: Record<ImportClassification, string> = {
  new: "bg-emerald-500/10 text-emerald-700",
  updated: "bg-indigo-500/10 text-indigo-700",
  unchanged: "bg-zinc-500/10 text-[var(--muted)]",
  invalid: "bg-red-500/10 text-red-700",
  conflicting: "bg-amber-500/10 text-amber-800",
};

export function VariableImportDialog({
  environmentId,
  projectId,
  variables,
  version,
  onImported,
}: {
  environmentId: string;
  projectId: string;
  variables: VariableDto[];
  version: number;
  onImported: (variables: VariableDto[], version: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DotenvDiagnostic[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [policy, setPolicy] = useState<ImportPolicy>("overwrite");
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  const counts = useMemo(() => {
    const result = preview.reduce<Record<ImportClassification, number>>(
      (result, item) => {
        result[item.classification] += 1;
        return result;
      },
      { new: 0, updated: 0, unchanged: 0, invalid: 0, conflicting: 0 },
    );
    result.invalid += diagnostics.filter(
      ({ severity }) => severity === "error",
    ).length;
    return result;
  }, [diagnostics, preview]);

  function resetImport() {
    setSource("");
    setFileName(null);
    setPreview([]);
    setDiagnostics([]);
    setSelected(new Set());
    setPolicy("overwrite");
    setProgress({ completed: 0, total: 0 });
  }

  function closeImport() {
    setOpen(false);
    resetImport();
  }

  function selectionForPolicy(
    items: PreviewItem[],
    nextPolicy: ImportPolicy,
  ): Set<string> {
    const next = new Set<string>();
    const lastConflictByKey = new Map<string, string>();

    for (const item of items) {
      if (item.classification === "new") next.add(item.id);
      if (nextPolicy === "overwrite" && item.classification === "updated") {
        next.add(item.id);
      }
      if (nextPolicy === "overwrite" && item.classification === "conflicting") {
        lastConflictByKey.set(item.entry.key, item.id);
      }
    }
    for (const id of lastConflictByKey.values()) next.add(id);
    return next;
  }

  async function createPreview() {
    if (!source.trim()) {
      toast.warning("Paste dotenv content or choose a file first.");
      return;
    }

    const keyState = getVaultKeyState();
    const vaultId = variables[0]?.vaultId ?? keyState.vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) {
      toast.warning("Unlock the vault before previewing an import.");
      return;
    }

    setPreviewing(true);
    try {
      const parsed = parseDotenv(source);
      const duplicateKeys = new Set(
        parsed.diagnostics
          .filter(({ code, key }) => code === "duplicate-key" && key)
          .map(({ key }) => key as string),
      );
      const existingByKey = new Map(
        variables.map((variable) => [variable.key.toUpperCase(), variable]),
      );
      const plaintextById = new Map<string, string>();

      await Promise.all(
        variables
          .filter((variable) =>
            parsed.entries.some(
              (entry) => entry.key.toUpperCase() === variable.key.toUpperCase(),
            ),
          )
          .map(async (variable) => {
            plaintextById.set(
              variable.id,
              await decryptVariableValue(
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
            );
          }),
      );

      const items = parsed.entries.map<PreviewItem>((entry) => {
        const existing = existingByKey.get(entry.key.toUpperCase()) ?? null;
        let classification: ImportClassification;
        if (!apiKeyPattern.test(entry.key)) classification = "invalid";
        else if (duplicateKeys.has(entry.key)) classification = "conflicting";
        else if (!existing) classification = "new";
        else if (plaintextById.get(existing.id) === entry.value) {
          classification = "unchanged";
        } else classification = "updated";

        return {
          id: `${entry.location.line}:${entry.location.column}:${entry.key}`,
          entry,
          classification,
          existing,
        };
      });

      setDiagnostics(parsed.diagnostics);
      setPreview(items);
      setSelected(selectionForPolicy(items, policy));
      toast.success("Import preview is ready.");
    } catch {
      toast.error(
        "Existing values could not be decrypted for a safe import preview.",
      );
    } finally {
      vaultKey.fill(0);
      setPreviewing(false);
    }
  }

  function toggleItem(item: PreviewItem) {
    if (
      item.classification === "invalid" ||
      item.classification === "unchanged"
    ) {
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        if (item.classification === "conflicting") {
          for (const candidate of preview) {
            if (
              candidate.entry.key === item.entry.key &&
              candidate.classification === "conflicting"
            ) {
              next.delete(candidate.id);
            }
          }
        }
        next.add(item.id);
      }
      return next;
    });
  }

  async function executeImport() {
    const chosen = preview.filter((item) => selected.has(item.id));
    if (chosen.length === 0) {
      toast.warning("Select at least one new or changed variable.");
      return;
    }

    const keyState = getVaultKeyState();
    const vaultId = variables[0]?.vaultId ?? keyState.vaultId;
    const vaultKey = vaultId ? getActiveVaultKey(vaultId) : null;
    if (!vaultId || !vaultKey) {
      toast.warning("Unlock the vault before importing variables.");
      return;
    }

    setImporting(true);
    setProgress({ completed: 0, total: chosen.length });
    let currentVersion = version;
    let currentVariables = [...variables];

    try {
      const encryptedVariables: ImportVariableItem[] = [];
      for (const item of chosen) {
        const variableId = item.existing?.id ?? crypto.randomUUID();
        const encrypted = await encryptVariableValue(
          getBrowserCryptoProvider(),
          vaultKey,
          item.entry.value,
          {
            vaultId,
            projectId,
            environmentId,
            variableId,
            encryptionVersion: 1,
          },
        );
        encryptedVariables.push({
          id: variableId,
          projectId,
          key: item.entry.key.toUpperCase(),
          encryptedValue: encrypted.ciphertext,
          encryptionIv: encrypted.iv,
          encryptionVersion: 1,
          visibility: item.existing?.visibility ?? "secret",
          tags: item.existing?.tags ?? [],
          description: item.existing?.description ?? null,
        });
      }

      for (let index = 0; index < encryptedVariables.length; index += 50) {
        const chunk = encryptedVariables.slice(index, index + 50);
        const operationId = crypto.randomUUID();
        let result;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            result = await client.imports.commit(environmentId, {
              operationId,
              expectedVersion: currentVersion,
              variables: chunk,
            });
            break;
          } catch (error) {
            const retryable =
              !(error instanceof EnvaultApiError) || error.status >= 500;
            if (!retryable || attempt === 1) throw error;
          }
        }
        if (!result) throw new Error("Import chunk did not return a result.");

        currentVersion = result.version;
        const importedById = new Map(
          result.variables.map((variable) => [variable.id, variable]),
        );
        currentVariables = [
          ...result.variables.filter(
            (variable) =>
              !currentVariables.some((current) => current.id === variable.id),
          ),
          ...currentVariables.map(
            (variable) => importedById.get(variable.id) ?? variable,
          ),
        ];
        setProgress({
          completed: Math.min(index + chunk.length, encryptedVariables.length),
          total: encryptedVariables.length,
        });
      }

      onImported(currentVariables, currentVersion);
      closeImport();
      toast.success(
        `${chosen.length} variable${chosen.length === 1 ? "" : "s"} imported securely.`,
      );
    } catch (error) {
      onImported(currentVariables, currentVersion);
      closeImport();
      toast.error(
        getUserFacingError(
          error,
          "The import stopped before every variable could be committed.",
        ),
      );
    } finally {
      vaultKey.fill(0);
      setImporting(false);
    }
  }

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-hover)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Upload className="size-4" />
        Import
      </button>
      <ActionDialog
        description="Parse and compare dotenv content locally. Plaintext values are encrypted before any API request."
        footer={
          <>
            <button
              className="rounded-xl border px-4 py-2.5 text-sm font-medium"
              onClick={closeImport}
              type="button"
            >
              Cancel
            </button>
            {preview.length > 0 ? (
              <button
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={importing || selected.size === 0}
                onClick={() => void executeImport()}
                type="button"
              >
                {importing
                  ? `Importing ${progress.completed}/${progress.total}…`
                  : `Import ${selected.size} selected`}
              </button>
            ) : (
              <button
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                disabled={previewing || !source.trim()}
                onClick={() => void createPreview()}
                type="button"
              >
                {previewing ? "Comparing securely…" : "Preview import"}
              </button>
            )}
          </>
        }
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetImport();
        }}
        open={open}
        size="xl"
        title="Import environment variables"
      >
        <div className="space-y-5">
          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed p-4 hover:bg-[var(--surface-hover)]">
            <span className="flex items-center gap-3">
              <FileUp className="size-5 text-indigo-500" />
              <span>
                <span className="block text-sm font-medium">
                  {fileName ?? "Choose a dotenv file"}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  .env, .env.local, .env.development or .env.production
                </span>
              </span>
            </span>
            <input
              accept=".env,.local,.development,.production,text/plain"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file
                  .text()
                  .then((content) => {
                    setSource(content);
                    setFileName(file.name);
                    setPreview([]);
                  })
                  .catch(() =>
                    toast.error("The selected file could not be read."),
                  );
              }}
              type="file"
            />
          </label>

          <label className="block text-sm font-medium">
            Or paste dotenv content
            <textarea
              className="mt-2 min-h-40 w-full resize-y rounded-xl border bg-transparent px-3.5 py-3 font-mono text-xs leading-6 outline-none focus:border-indigo-500"
              onChange={(event) => {
                setSource(event.target.value);
                setFileName(null);
                setPreview([]);
              }}
              placeholder={"API_URL=https://api.example.com\nLOG_LEVEL=debug"}
              spellCheck={false}
              value={source}
            />
          </label>

          {preview.length > 0 ? (
            <>
              {importing && progress.total > 0 ? (
                <div className="rounded-xl border p-3">
                  <div className="flex justify-between text-xs">
                    <span>Secure import progress</span>
                    <span>
                      {progress.completed} / {progress.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--app-background)]">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-[width]"
                      style={{
                        width: `${(progress.completed / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(Object.keys(counts) as ImportClassification[]).map(
                  (classification) => (
                    <div
                      className="rounded-xl border p-3 text-center"
                      key={classification}
                    >
                      <p className="text-lg font-semibold">
                        {counts[classification]}
                      </p>
                      <p className="mt-0.5 text-[11px] capitalize text-[var(--muted)]">
                        {classification}
                      </p>
                    </div>
                  ),
                )}
              </div>
              <label className="block text-sm font-medium">
                Conflict policy
                <select
                  className="mt-2 w-full rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-sm"
                  onChange={(event) => {
                    const nextPolicy = event.target.value as ImportPolicy;
                    setPolicy(nextPolicy);
                    setSelected(selectionForPolicy(preview, nextPolicy));
                  }}
                  value={policy}
                >
                  <option value="overwrite">Overwrite changed values</option>
                  <option value="skip-existing">Skip existing variables</option>
                  <option value="new-only">Import new variables only</option>
                </select>
              </label>
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                {preview.map((item) => (
                  <label
                    className="flex items-center gap-3 border-b px-3 py-3 last:border-0"
                    key={item.id}
                  >
                    <input
                      checked={selected.has(item.id)}
                      disabled={
                        item.classification === "invalid" ||
                        item.classification === "unchanged"
                      }
                      onChange={() => toggleItem(item)}
                      type="checkbox"
                    />
                    <code className="min-w-0 flex-1 truncate text-xs">
                      {item.entry.key}
                    </code>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-medium capitalize ${classificationStyles[item.classification]}`}
                    >
                      {item.classification}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      line {item.entry.location.line}
                    </span>
                  </label>
                ))}
              </div>
              {diagnostics.length > 0 ? (
                <div className="rounded-xl border bg-[var(--app-background)] p-3">
                  <p className="text-xs font-medium">Parser notes</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    {diagnostics.map((diagnostic, index) => (
                      <li
                        key={`${diagnostic.code}:${diagnostic.location.line}:${index}`}
                      >
                        Line {diagnostic.location.line}: {diagnostic.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </ActionDialog>
    </>
  );
}
