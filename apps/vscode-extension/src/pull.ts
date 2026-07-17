import type { EnvaultClient } from "@envault/api-client";
import { serializeDotenv } from "@envault/dotenv";
import * as vscode from "vscode";

import { requireClient } from "./client";
import { decryptVariable } from "./crypto";
import { resolveBinding, type ResolvedTarget } from "./selection";
import { ensureUnlocked } from "./unlock";
import type { VaultSession } from "./vault-session";

async function readFileIfExists(uri: vscode.Uri): Promise<string | null> {
  try {
    return Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

async function confirmOverwrite(
  targetUri: vscode.Uri,
  relativePath: string,
  existing: string,
  next: string,
  environmentName: string,
): Promise<boolean> {
  if (existing === next) {
    void vscode.window.showInformationMessage(
      `"${relativePath}" is already up to date with ${environmentName}.`,
    );
    return false;
  }
  const choice = await vscode.window.showWarningMessage(
    `"${relativePath}" already exists and differs from ${environmentName}.`,
    { modal: true },
    "Overwrite",
    "Compare",
  );
  if (choice === "Compare") {
    const preview = await vscode.workspace.openTextDocument({
      content: next,
      language: "dotenv",
    });
    await vscode.commands.executeCommand(
      "vscode.diff",
      targetUri,
      preview.uri,
      `${relativePath} ↔ ${environmentName} (incoming)`,
    );
    const confirm = await vscode.window.showWarningMessage(
      `Overwrite "${relativePath}" with ${environmentName}?`,
      { modal: true },
      "Overwrite",
    );
    return confirm === "Overwrite";
  }
  return choice === "Overwrite";
}

async function decryptAll(
  client: EnvaultClient,
  key: Uint8Array,
  environmentId: string,
): Promise<{ key: string; value: string }[]> {
  const { variables } = await client.variables.list(environmentId);
  const entries: { key: string; value: string }[] = [];
  for (const variable of variables) {
    try {
      entries.push({
        key: variable.key,
        value: await decryptVariable(key, variable),
      });
    } catch {
      throw new Error(
        `"${variable.key}" could not be decrypted with the current vault key.`,
      );
    }
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

export async function pullEnvironment(
  context: vscode.ExtensionContext,
  session: VaultSession,
  target?: ResolvedTarget,
): Promise<void> {
  const client = await requireClient(context);
  if (!client) return;

  const resolved = target ?? (await resolveBinding(context));
  if (!resolved) return;
  const { folder, binding } = resolved;

  const unlocked = await ensureUnlocked(context, session);
  if (!unlocked) return;

  try {
    const entries = await decryptAll(
      client,
      unlocked.key,
      binding.environmentId,
    );
    const content = entries.length > 0 ? `${serializeDotenv(entries)}\n` : "";

    const relativePath = binding.targetFile ?? ".env";
    const targetUri = vscode.Uri.joinPath(folder.uri, relativePath);
    const existing = await readFileIfExists(targetUri);
    if (
      existing !== null &&
      !(await confirmOverwrite(
        targetUri,
        relativePath,
        existing,
        content,
        binding.environmentName,
      ))
    ) {
      return;
    }

    await vscode.workspace.fs.writeFile(
      targetUri,
      Buffer.from(content, "utf8"),
    );
    void vscode.window.showInformationMessage(
      `Pulled ${entries.length} variable${entries.length === 1 ? "" : "s"} from ${binding.environmentName} into ${relativePath}.`,
    );
  } catch (error) {
    void vscode.window.showErrorMessage(
      error instanceof Error
        ? error.message
        : "The environment could not be pulled.",
    );
  } finally {
    unlocked.key.fill(0);
  }
}
