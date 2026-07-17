import type { EnvironmentDto, ProjectDto } from "@envault/api-contract";
import * as vscode from "vscode";

import { showStatus, signIn, signOut } from "./auth";
import { getAccessToken } from "./client";
import { stateChanged } from "./events";
import { pullEnvironment } from "./pull";
import { pushEnvironment } from "./push";
import {
  bindTarget,
  selectEnvironment,
  type ResolvedTarget,
} from "./selection";
import { createStatusBar } from "./status-bar";
import { EnvaultTreeProvider } from "./tree";
import { ensureUnlocked } from "./unlock";
import { VaultSession } from "./vault-session";

interface EnvironmentNodeArg {
  kind: "environment";
  project: ProjectDto;
  environment: EnvironmentDto;
}

/** Resolves a tree context-menu argument into an explicit push/pull target. */
async function targetFromArg(
  context: vscode.ExtensionContext,
  arg: unknown,
): Promise<ResolvedTarget | undefined> {
  const node = arg as EnvironmentNodeArg | undefined;
  if (node?.kind !== "environment") return undefined;
  return bindTarget(context, node.project, node.environment);
}

async function quickActions(
  context: vscode.ExtensionContext,
  session: VaultSession,
): Promise<void> {
  const connected = (await getAccessToken(context)) !== null;
  if (!connected) {
    await vscode.commands.executeCommand("envault.signIn");
    return;
  }
  const actions: { label: string; command: string }[] = [
    { label: "$(cloud-download) Pull environment → .env", command: "envault.pull" },
    { label: "$(cloud-upload) Push .env → environment", command: "envault.push" },
    { label: "$(list-selection) Select environment", command: "envault.selectEnvironment" },
    session.isUnlocked
      ? { label: "$(lock) Lock vault", command: "envault.lock" }
      : { label: "$(unlock) Unlock vault", command: "envault.unlock" },
    { label: "$(sign-out) Sign out", command: "envault.signOut" },
  ];
  const pick = await vscode.window.showQuickPick(actions, {
    placeHolder: "Envault",
  });
  if (pick) await vscode.commands.executeCommand(pick.command);
}

async function bindEnvironment(
  context: vscode.ExtensionContext,
  project: ProjectDto,
  environment: EnvironmentDto,
): Promise<void> {
  const target = await bindTarget(context, project, environment);
  if (target) {
    void vscode.window.showInformationMessage(
      `Envault: ${target.folder.name} → ${project.name} / ${environment.name}`,
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  const session = new VaultSession();
  const tree = new EnvaultTreeProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("envault.signIn", () => signIn(context)),
    vscode.commands.registerCommand("envault.signOut", () =>
      signOut(context, session),
    ),
    vscode.commands.registerCommand("envault.status", () =>
      showStatus(context, session),
    ),
    vscode.commands.registerCommand("envault.selectEnvironment", () =>
      selectEnvironment(context),
    ),
    vscode.commands.registerCommand("envault.unlock", async () => {
      const unlocked = await ensureUnlocked(context, session);
      if (unlocked) {
        unlocked.key.fill(0);
        void vscode.window.showInformationMessage("Envault vault unlocked.");
      }
    }),
    vscode.commands.registerCommand("envault.lock", () => {
      session.lock();
      void vscode.window.showInformationMessage("Envault vault locked.");
    }),
    vscode.commands.registerCommand("envault.pull", async (arg?: unknown) =>
      pullEnvironment(context, session, await targetFromArg(context, arg)),
    ),
    vscode.commands.registerCommand("envault.push", async (arg?: unknown) =>
      pushEnvironment(context, session, await targetFromArg(context, arg)),
    ),
    vscode.commands.registerCommand("envault.quickActions", () =>
      quickActions(context, session),
    ),
    vscode.commands.registerCommand("envault.refresh", () => tree.refresh()),
    vscode.commands.registerCommand(
      "envault.bindEnvironment",
      (project: ProjectDto, environment: EnvironmentDto) =>
        bindEnvironment(context, project, environment),
    ),
    session,
    createStatusBar(context, session),
    vscode.window.registerTreeDataProvider("envault.explorer", tree),
    stateChanged.event(() => tree.refresh()),
    stateChanged,
  );
}

export function deactivate() {}
