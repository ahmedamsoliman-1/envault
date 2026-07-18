import { KeepApiError, type KeepClient } from "@keephq/api-client";
import type {
  ClipboardItemDto,
  ClipboardPersistenceMode,
} from "@keephq/api-contract";
import * as vscode from "vscode";

import { requireClient } from "./client";

const CONTENT_ICON: Record<ClipboardItemDto["contentType"], string> = {
  text: "note",
  url: "link",
  code: "code",
  json: "json",
  command: "terminal",
};

const PERSISTENCE_PICKS: {
  label: string;
  detail: string;
  mode: ClipboardPersistenceMode;
}[] = [
  {
    label: "$(clock) Keep temporarily",
    detail: "Expires automatically after the retention window.",
    mode: "temporary",
  },
  {
    label: "$(flame) Send once",
    detail: "Removed as soon as it is read on another device.",
    mode: "once",
  },
  {
    label: "$(pin) Pin",
    detail: "Kept until you unpin or delete it.",
    mode: "pinned",
  },
];

/** A QuickPick button that also records which action it triggers. */
interface ActionButton extends vscode.QuickInputButton {
  action: "insert" | "pin" | "unpin" | "delete";
}

interface ClipboardQuickItem extends vscode.QuickPickItem {
  item: ClipboardItemDto;
}

const actionButton = (
  icon: string,
  tooltip: string,
  action: ActionButton["action"],
): ActionButton => ({ iconPath: new vscode.ThemeIcon(icon), tooltip, action });

function toQuickItem(item: ClipboardItemDto): ClipboardQuickItem {
  const icon =
    item.sensitivity === "normal" ? CONTENT_ICON[item.contentType] : "shield";
  const tags: string[] = [item.originClient, item.contentType];
  if (item.pinnedAt) tags.push("pinned");
  if (item.sensitivity !== "normal") tags.push(item.sensitivity);
  return {
    label: `$(${icon}) ${item.safePreview ?? "(hidden)"}`,
    description: tags.join(" · "),
    item,
    buttons: [
      actionButton("arrow-right", "Insert into editor", "insert"),
      item.pinnedAt
        ? actionButton("pinned", "Unpin", "unpin")
        : actionButton("pin", "Pin", "pin"),
      actionButton("trash", "Delete", "delete"),
    ],
  };
}

function reportError(error: unknown): void {
  if (error instanceof KeepApiError) {
    if (error.status === 404) {
      void vscode.window.showWarningMessage(
        "Keep Clipboard is not enabled on the server.",
      );
      return;
    }
    if (error.status === 401 || error.status === 403) {
      void vscode.window.showWarningMessage(
        "This device is not authorized for Keep Clipboard. Run “Keep: Sign in” to reconnect with clipboard access.",
      );
      return;
    }
  }
  void vscode.window.showErrorMessage(
    error instanceof Error ? error.message : "Keep Clipboard request failed.",
  );
}

/** Reads the item's content and either copies it or inserts it into the editor. */
async function receiveItem(
  client: KeepClient,
  item: ClipboardItemDto,
  insert: boolean,
): Promise<void> {
  // A one-time item is removed as it is read, so consume it instead of get.
  const detail =
    item.persistenceMode === "once"
      ? await client.clipboard.consume(item.id)
      : await client.clipboard.get(item.id);

  const editor = vscode.window.activeTextEditor;
  if (insert && editor) {
    await editor.edit((builder) =>
      builder.replace(editor.selection, detail.content),
    );
    void vscode.window.showInformationMessage("Inserted from Keep Clipboard.");
    return;
  }
  await vscode.env.clipboard.writeText(detail.content);
  void vscode.window.showInformationMessage("Copied to your clipboard.");
}

/**
 * Sends the current editor selection (or the OS clipboard, when there is no
 * selection) to Keep Clipboard, tagging it as originating from VS Code.
 */
export async function sendToClipboard(
  context: vscode.ExtensionContext,
): Promise<void> {
  const client = await requireClient(context);
  if (!client) return;

  const editor = vscode.window.activeTextEditor;
  let content: string;
  let language: string | null = null;
  if (editor && !editor.selection.isEmpty) {
    content = editor.document.getText(editor.selection);
    language = editor.document.languageId || null;
  } else {
    content = await vscode.env.clipboard.readText();
  }

  if (!content.trim()) {
    void vscode.window.showWarningMessage(
      "Nothing to send — select some text or copy something first.",
    );
    return;
  }

  const choice = await vscode.window.showQuickPick(PERSISTENCE_PICKS, {
    placeHolder: "How should Keep keep this item?",
  });
  if (!choice) return;

  try {
    const item = await client.clipboard.create({
      content,
      originClient: "vscode",
      language,
      persistenceMode: choice.mode,
    });
    void vscode.window.showInformationMessage(
      item.sensitivity === "normal"
        ? "Sent to Keep Clipboard."
        : "Sent to Keep Clipboard (flagged as sensitive).",
    );
  } catch (error) {
    reportError(error);
  }
}

/**
 * Opens the remote clipboard history as a Quick Pick. Accepting an item copies
 * it; per-item buttons insert, pin/unpin, or delete — the same actions the web
 * workspace offers.
 */
export async function showClipboardHistory(
  context: vscode.ExtensionContext,
): Promise<void> {
  const client = await requireClient(context);
  if (!client) return;

  const quickPick = vscode.window.createQuickPick<ClipboardQuickItem>();
  quickPick.placeholder =
    "Select an item to copy — use the buttons to insert, pin, or delete";
  quickPick.matchOnDescription = true;

  const load = async () => {
    quickPick.busy = true;
    try {
      const { items } = await client.clipboard.list();
      quickPick.items = items.map(toQuickItem);
      if (items.length === 0) {
        quickPick.placeholder = "Keep Clipboard is empty.";
      }
    } catch (error) {
      quickPick.hide();
      reportError(error);
    } finally {
      quickPick.busy = false;
    }
  };

  quickPick.onDidAccept(() => {
    const picked = quickPick.selectedItems[0];
    if (!picked) return;
    quickPick.hide();
    void receiveItem(client, picked.item, false).catch(reportError);
  });

  quickPick.onDidTriggerItemButton(async ({ item, button }) => {
    const action = (button as ActionButton).action;
    try {
      if (action === "insert") {
        quickPick.hide();
        await receiveItem(client, item.item, true);
        return;
      }
      if (action === "delete") await client.clipboard.delete(item.item.id);
      else if (action === "pin") await client.clipboard.pin(item.item.id);
      else if (action === "unpin") await client.clipboard.unpin(item.item.id);
      await load();
    } catch (error) {
      reportError(error);
    }
  });

  quickPick.onDidHide(() => quickPick.dispose());
  quickPick.show();
  await load();
}
