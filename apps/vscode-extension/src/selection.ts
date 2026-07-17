import * as vscode from "vscode";

import { requireClient } from "./client";
import { stateChanged } from "./events";

export interface EnvironmentBinding {
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  /** Workspace-relative path of the dotenv file this environment syncs with. */
  targetFile?: string;
}

function bindingKey(folder: vscode.WorkspaceFolder): string {
  return `envault.binding:${folder.uri.toString()}`;
}

export function getBinding(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
): EnvironmentBinding | undefined {
  return context.workspaceState.get<EnvironmentBinding>(bindingKey(folder));
}

export async function setBinding(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  binding: EnvironmentBinding | undefined,
): Promise<void> {
  await context.workspaceState.update(bindingKey(folder), binding);
  stateChanged.fire();
}

/** The workspace folder for the active editor, else the sole/first folder. */
export function activeFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const match = vscode.workspace.getWorkspaceFolder(activeUri);
    if (match) return match;
  }
  return folders[0];
}

/** Picks a workspace folder, prompting only when several are open. */
export async function resolveTargetFolder(): Promise<
  vscode.WorkspaceFolder | undefined
> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showWarningMessage(
      "Open a folder before selecting an Envault environment.",
    );
    return undefined;
  }
  if (folders.length === 1) return folders[0];
  const pick = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, folder })),
    { placeHolder: "Select the workspace folder to bind" },
  );
  return pick?.folder;
}

export interface ResolvedTarget {
  folder: vscode.WorkspaceFolder;
  binding: EnvironmentBinding;
}

/**
 * Binds a specific project/environment (e.g. chosen from the tree) to a folder
 * and returns the resolved target, preserving any existing dotenv file mapping.
 */
export async function bindTarget(
  context: vscode.ExtensionContext,
  project: { id: string; name: string },
  environment: { id: string; name: string },
): Promise<ResolvedTarget | undefined> {
  const folder = await resolveTargetFolder();
  if (!folder) return undefined;
  const previous = getBinding(context, folder);
  const binding: EnvironmentBinding = {
    projectId: project.id,
    projectName: project.name,
    environmentId: environment.id,
    environmentName: environment.name,
    targetFile: previous?.targetFile ?? ".env",
  };
  await setBinding(context, folder, binding);
  return { folder, binding };
}

/**
 * Returns the active folder's bound environment, prompting for a selection when
 * nothing is bound yet.
 */
export async function resolveBinding(
  context: vscode.ExtensionContext,
): Promise<
  { folder: vscode.WorkspaceFolder; binding: EnvironmentBinding } | undefined
> {
  const current = activeFolder();
  if (current) {
    const binding = getBinding(context, current);
    if (binding) return { folder: current, binding };
  }
  const binding = await selectEnvironment(context);
  if (!binding) return undefined;
  const chosen = activeFolder();
  if (!chosen) return undefined;
  return { folder: chosen, binding: getBinding(context, chosen) ?? binding };
}

export async function selectEnvironment(
  context: vscode.ExtensionContext,
): Promise<EnvironmentBinding | undefined> {
  const client = await requireClient(context);
  if (!client) return undefined;

  const folder = await resolveTargetFolder();
  if (!folder) return undefined;

  try {
    const { projects } = await client.projects.list();
    if (projects.length === 0) {
      void vscode.window.showInformationMessage(
        "No Envault projects yet. Create one from the web app first.",
      );
      return undefined;
    }
    const project = await vscode.window.showQuickPick(
      projects.map((item) => ({
        label: item.name,
        description: item.description ?? undefined,
        project: item,
      })),
      { placeHolder: "Select an Envault project" },
    );
    if (!project) return undefined;

    const { environments } = await client.environments.list(project.project.id);
    if (environments.length === 0) {
      void vscode.window.showInformationMessage(
        `"${project.label}" has no environments yet.`,
      );
      return undefined;
    }
    const environment = await vscode.window.showQuickPick(
      environments.map((item) => ({
        label: item.name,
        description: `${item.kind} · version ${item.version}`,
        environment: item,
      })),
      { placeHolder: "Select an Envault environment" },
    );
    if (!environment) return undefined;

    const previous = getBinding(context, folder);
    const binding: EnvironmentBinding = {
      projectId: project.project.id,
      projectName: project.project.name,
      environmentId: environment.environment.id,
      environmentName: environment.environment.name,
      targetFile: previous?.targetFile ?? ".env",
    };
    await setBinding(context, folder, binding);
    void vscode.window.showInformationMessage(
      `Envault: ${folder.name} → ${binding.projectName} / ${binding.environmentName}`,
    );
    return binding;
  } catch (error) {
    void vscode.window.showErrorMessage(
      error instanceof Error
        ? error.message
        : "The Envault environment could not be selected.",
    );
    return undefined;
  }
}
