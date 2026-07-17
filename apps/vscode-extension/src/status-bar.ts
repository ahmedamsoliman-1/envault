import * as vscode from "vscode";

import { getAccessToken } from "./client";
import { stateChanged } from "./events";
import { activeFolder, getBinding } from "./selection";
import type { VaultSession } from "./vault-session";

/**
 * A single status-bar entry reflecting connection, lock state and the active
 * folder's bound environment. Clicking it opens the Envault quick-actions menu.
 */
export function createStatusBar(
  context: vscode.ExtensionContext,
  session: VaultSession,
): vscode.Disposable {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

  async function refresh(): Promise<void> {
    const token = await getAccessToken(context);
    if (!token) {
      item.text = "$(key) Envault";
      item.tooltip = "Sign in to Envault";
      item.command = "envault.signIn";
      item.show();
      return;
    }
    const folder = activeFolder();
    const binding = folder ? getBinding(context, folder) : undefined;
    const environment = binding
      ? `${binding.projectName}/${binding.environmentName}`
      : "no environment";
    const icon = session.isUnlocked ? "$(unlock)" : "$(lock)";
    item.text = `${icon} Envault: ${environment}`;
    item.tooltip = session.isUnlocked
      ? "Envault vault unlocked — click for actions"
      : "Envault vault locked — click for actions";
    item.command = "envault.quickActions";
    item.show();
  }

  void refresh();

  return vscode.Disposable.from(
    item,
    session.onDidChange(() => void refresh()),
    stateChanged.event(() => void refresh()),
    context.secrets.onDidChange(() => void refresh()),
    vscode.window.onDidChangeActiveTextEditor(() => void refresh()),
  );
}
