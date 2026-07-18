import type { EnvironmentDto, ProjectDto } from "@keephq/api-contract";
import * as vscode from "vscode";

import { showStatus, signIn, signOut } from "./auth";
import { getAccessToken } from "./client";
import { sendToClipboard, showClipboardHistory } from "./clipboard";
import { stateChanged } from "./events";
import { pullEnvironment } from "./pull";
import { pushEnvironment } from "./push";
import {
  bindTarget,
  selectEnvironment,
  type ResolvedTarget,
} from "./selection";
import { createStatusBar } from "./status-bar";
import { KeepTreeProvider } from "./tree";
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
    await vscode.commands.executeCommand("keep.signIn");
    return;
  }
  const actions: { label: string; command: string }[] = [
    {
      label: "$(cloud-download) Pull environment → .env",
      command: "keep.pull",
    },
    { label: "$(cloud-upload) Push .env → environment", command: "keep.push" },
    {
      label: "$(clippy) Send selection to Keep Clipboard",
      command: "keep.clipboard.send",
    },
    {
      label: "$(history) Open Keep Clipboard history",
      command: "keep.clipboard.history",
    },
    {
      label: "$(list-selection) Select environment",
      command: "keep.selectEnvironment",
    },
    session.isUnlocked
      ? { label: "$(lock) Lock vault", command: "keep.lock" }
      : { label: "$(unlock) Unlock vault", command: "keep.unlock" },
    { label: "$(sign-out) Sign out", command: "keep.signOut" },
  ];
  const pick = await vscode.window.showQuickPick(actions, {
    placeHolder: "Keep",
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
      `Keep: ${target.folder.name} → ${project.name} / ${environment.name}`,
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  const session = new VaultSession();
  const tree = new KeepTreeProvider(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("keep.signIn", () => signIn(context)),
    vscode.commands.registerCommand("keep.signOut", () =>
      signOut(context, session),
    ),
    vscode.commands.registerCommand("keep.status", () =>
      showStatus(context, session),
    ),
    vscode.commands.registerCommand("keep.selectEnvironment", () =>
      selectEnvironment(context),
    ),
    vscode.commands.registerCommand("keep.unlock", async () => {
      const unlocked = await ensureUnlocked(context, session);
      if (unlocked) {
        unlocked.key.fill(0);
        void vscode.window.showInformationMessage("Keep vault unlocked.");
      }
    }),
    vscode.commands.registerCommand("keep.lock", () => {
      session.lock();
      void vscode.window.showInformationMessage("Keep vault locked.");
    }),
    vscode.commands.registerCommand("keep.pull", async (arg?: unknown) =>
      pullEnvironment(context, session, await targetFromArg(context, arg)),
    ),
    vscode.commands.registerCommand("keep.push", async (arg?: unknown) =>
      pushEnvironment(context, session, await targetFromArg(context, arg)),
    ),
    vscode.commands.registerCommand("keep.clipboard.send", () =>
      sendToClipboard(context),
    ),
    vscode.commands.registerCommand("keep.clipboard.history", () =>
      showClipboardHistory(context),
    ),
    vscode.commands.registerCommand("keep.quickActions", () =>
      quickActions(context, session),
    ),
    vscode.commands.registerCommand("keep.refresh", () => tree.refresh()),
    vscode.commands.registerCommand(
      "keep.bindEnvironment",
      (project: ProjectDto, environment: EnvironmentDto) =>
        bindEnvironment(context, project, environment),
    ),
    session,
    createStatusBar(context, session),
    vscode.window.registerTreeDataProvider("keep.explorer", tree),
    stateChanged.event(() => tree.refresh()),
    stateChanged,
  );
}

export function deactivate() {}
