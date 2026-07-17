import { EnvaultApiError, type EnvaultClient } from "@envault/api-client";
import type { ImportVariableItem, VariableDto } from "@envault/api-contract";
import { parseDotenv, serializeDotenv } from "@envault/dotenv";
import { randomUUID } from "node:crypto";
import * as vscode from "vscode";

import { requireClient } from "./client";
import { decryptVariable } from "./crypto";
import { stateChanged } from "./events";
import {
  buildPushPlan,
  encodePlanItems,
  planHasChanges,
  type PushPlan,
} from "./push-plan";
import { resolveBinding, type ResolvedTarget } from "./selection";
import { ensureUnlocked } from "./unlock";
import type { VaultSession } from "./vault-session";

const IMPORT_CHUNK_SIZE = 100;

async function readFileIfExists(uri: vscode.Uri): Promise<string | null> {
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

async function decryptRemote(
  vaultKey: Uint8Array,
  variables: VariableDto[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const variable of variables) {
    try {
      map.set(variable.id, await decryptVariable(vaultKey, variable));
    } catch {
      throw new Error(
        `Remote variable "${variable.key}" could not be decrypted with the current vault key.`,
      );
    }
  }
  return map;
}

function summarize(plan: PushPlan, environmentName: string): string {
  const lines = [
    `Create: ${plan.create.length}`,
    `Update: ${plan.update.length}`,
    `Unchanged: ${plan.unchangedCount}`,
  ];
  if (plan.remoteOnly.length > 0)
    lines.push(`Remote-only (left untouched): ${plan.remoteOnly.length}`);
  if (plan.invalid.length > 0)
    lines.push(`Invalid (skipped): ${plan.invalid.length}`);
  if (plan.warnings.length > 0) lines.push("", ...plan.warnings);
  if (plan.invalid.length > 0)
    lines.push(
      "",
      ...plan.invalid.map(({ key, reason }) => `${key}: ${reason}`),
    );
  void environmentName;
  return lines.join("\n");
}

function isVersionConflict(error: unknown): boolean {
  return error instanceof EnvaultApiError && error.status === 409;
}

async function commitChunks(
  client: EnvaultClient,
  environmentId: string,
  items: ImportVariableItem[],
  startVersion: number,
): Promise<number> {
  let expectedVersion = startVersion;
  for (let index = 0; index < items.length; index += IMPORT_CHUNK_SIZE) {
    const chunk = items.slice(index, index + IMPORT_CHUNK_SIZE);
    const result = await client.imports.commit(environmentId, {
      operationId: randomUUID(),
      expectedVersion,
      variables: chunk,
    });
    expectedVersion = result.version;
  }
  return expectedVersion;
}

async function openCompareWithRemote(
  targetUri: vscode.Uri,
  remoteDecrypted: { key: string; value: string }[],
  environmentName: string,
): Promise<void> {
  const sorted = [...remoteDecrypted].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const content = sorted.length > 0 ? `${serializeDotenv(sorted)}\n` : "";
  const preview = await vscode.workspace.openTextDocument({
    content,
    language: "dotenv",
  });
  await vscode.commands.executeCommand(
    "vscode.diff",
    targetUri,
    preview.uri,
    `local ↔ ${environmentName} (remote)`,
  );
}

export async function pushEnvironment(
  context: vscode.ExtensionContext,
  session: VaultSession,
  target?: ResolvedTarget,
): Promise<void> {
  const client = await requireClient(context);
  if (!client) return;

  const resolved = target ?? (await resolveBinding(context));
  if (!resolved) return;
  const { folder, binding } = resolved;

  const relativePath = binding.targetFile ?? ".env";
  const targetUri = vscode.Uri.joinPath(folder.uri, relativePath);
  const source = await readFileIfExists(targetUri);
  if (source === null) {
    void vscode.window.showWarningMessage(
      `No "${relativePath}" found in ${folder.name}. Pull first or create the file.`,
    );
    return;
  }

  const parsed = parseDotenv(source);
  const errors = parsed.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (errors.length > 0) {
    void vscode.window.showErrorMessage(
      `"${relativePath}" has ${errors.length} parse error${errors.length === 1 ? "" : "s"}: ${errors[0]?.message}`,
    );
    return;
  }

  const unlocked = await ensureUnlocked(context, session);
  if (!unlocked) return;

  try {
    let confirmed = false;
    // Re-fetch and re-plan each iteration so retries after a conflict never push
    // stale data.
    for (;;) {
      const remote = await client.variables.list(binding.environmentId);
      const decrypted = await decryptRemote(unlocked.key, remote.variables);
      const plan = buildPushPlan(source, remote.variables, decrypted);

      if (!planHasChanges(plan)) {
        void vscode.window.showInformationMessage(
          `${binding.environmentName} is already up to date with ${relativePath}.`,
        );
        return;
      }

      if (!confirmed) {
        const choice = await vscode.window.showWarningMessage(
          `Push ${relativePath} to ${binding.environmentName}?`,
          { modal: true, detail: summarize(plan, binding.environmentName) },
          "Push",
        );
        if (choice !== "Push") return;
        confirmed = true;
      }

      const items = await encodePlanItems(
        plan,
        unlocked.key,
        {
          vaultId: unlocked.vault.vaultId,
          projectId: binding.projectId,
          environmentId: binding.environmentId,
        },
        randomUUID,
      );

      try {
        await commitChunks(
          client,
          binding.environmentId,
          items,
          remote.version,
        );
        stateChanged.fire();
        void vscode.window.showInformationMessage(
          `Pushed to ${binding.environmentName}: ${plan.create.length} created, ${plan.update.length} updated.`,
        );
        return;
      } catch (error) {
        if (!isVersionConflict(error)) throw error;
        const choice = await vscode.window.showWarningMessage(
          `${binding.environmentName} changed on the server since you last pulled.`,
          { modal: true },
          "Overwrite remote",
          "Compare & merge",
        );
        if (choice === "Overwrite remote") {
          continue; // re-fetch latest version and re-plan; local values win.
        }
        if (choice === "Compare & merge") {
          const entries = remote.variables.map((variable) => ({
            key: variable.key,
            value: decrypted.get(variable.id) ?? "",
          }));
          await openCompareWithRemote(
            targetUri,
            entries,
            binding.environmentName,
          );
        }
        return;
      }
    }
  } catch (error) {
    void vscode.window.showErrorMessage(
      error instanceof Error ? error.message : "The push could not be completed.",
    );
  } finally {
    unlocked.key.fill(0);
  }
}
