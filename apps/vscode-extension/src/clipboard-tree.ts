import type { ClipboardItemDto } from "@keephq/api-contract";
import * as vscode from "vscode";

import { createClient, getAccessToken, requireClient } from "./client";
import { CONTENT_ICON, receiveItem, reportError } from "./clipboard";
import { stateChanged } from "./events";

interface ClipboardItemNode {
  kind: "item";
  item: ClipboardItemDto;
}
interface ClipboardEmptyNode {
  kind: "empty";
}
type ClipboardNode = ClipboardItemNode | ClipboardEmptyNode;

/**
 * A scrollable view of the remote Keep Clipboard stream. Each row is a synced
 * item (its safe preview); the content itself is fetched on demand when the user
 * copies or inserts it, so plaintext is never held in the tree. Sensitive items
 * stay masked, matching the web workspace and the history Quick Pick.
 */
export class ClipboardTreeProvider implements vscode.TreeDataProvider<ClipboardNode> {
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    stateChanged.event(() => this.#onDidChangeTreeData.fire());
    context.secrets.onDidChange((event) => {
      if (event.key === "envault.deviceAccessToken")
        this.#onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    this.#onDidChangeTreeData.fire();
  }

  getTreeItem(node: ClipboardNode): vscode.TreeItem {
    if (node.kind === "empty") {
      const empty = new vscode.TreeItem(
        "No clipboard items yet",
        vscode.TreeItemCollapsibleState.None,
      );
      empty.iconPath = new vscode.ThemeIcon("clippy");
      empty.tooltip =
        "Send a selection with “Keep: Send selection to Clipboard”, or copy something on another device.";
      empty.contextValue = "keepClipboardEmpty";
      return empty;
    }
    const { item } = node;
    const icon =
      item.sensitivity === "normal" ? CONTENT_ICON[item.contentType] : "shield";
    const treeItem = new vscode.TreeItem(
      item.safePreview ?? "(hidden)",
      vscode.TreeItemCollapsibleState.None,
    );
    const tags: string[] = [item.originClient];
    if (item.pinnedAt) tags.push("pinned");
    if (item.persistenceMode === "once") tags.push("once");
    if (item.sensitivity !== "normal") tags.push(item.sensitivity);
    treeItem.description = tags.join(" · ");
    treeItem.iconPath = new vscode.ThemeIcon(icon);
    treeItem.tooltip = new vscode.MarkdownString(
      [
        `**${item.contentType}** · ${item.byteLength} bytes`,
        `from ${item.originClient}`,
        item.language ? `language: ${item.language}` : undefined,
      ]
        .filter(Boolean)
        .join("  \n"),
    );
    treeItem.contextValue = item.pinnedAt
      ? "keepClipboardItemPinned"
      : "keepClipboardItem";
    // Default click copies the item into the OS clipboard.
    treeItem.command = {
      command: "keep.clipboard.copyItem",
      title: "Copy to clipboard",
      arguments: [node],
    };
    return treeItem;
  }

  async getChildren(node?: ClipboardNode): Promise<ClipboardNode[]> {
    if (node) return [];
    const token = await getAccessToken(this.context);
    if (!token) return [];
    const client = createClient(token);
    try {
      const { items } = await client.clipboard.list();
      if (items.length === 0) return [{ kind: "empty" }];
      return items.map((item) => ({ kind: "item", item }));
    } catch {
      return [];
    }
  }
}

/** Copies a stream item into the OS clipboard (fetches content on demand). */
export async function copyClipboardNode(
  context: vscode.ExtensionContext,
  node: unknown,
): Promise<void> {
  const item = (node as ClipboardItemNode | undefined)?.item;
  if (!item) return;
  const client = await requireClient(context);
  if (!client) return;
  try {
    await receiveItem(client, item, false);
    stateChanged.fire();
  } catch (error) {
    reportError(error);
  }
}

/** Inserts a stream item at the active editor selection. */
export async function insertClipboardNode(
  context: vscode.ExtensionContext,
  node: unknown,
): Promise<void> {
  const item = (node as ClipboardItemNode | undefined)?.item;
  if (!item) return;
  const client = await requireClient(context);
  if (!client) return;
  try {
    await receiveItem(client, item, true);
    stateChanged.fire();
  } catch (error) {
    reportError(error);
  }
}

/** Pins, unpins or deletes a stream item, then refreshes the view. */
export async function mutateClipboardNode(
  context: vscode.ExtensionContext,
  node: unknown,
  action: "pin" | "unpin" | "delete",
): Promise<void> {
  const item = (node as ClipboardItemNode | undefined)?.item;
  if (!item) return;
  const client = await requireClient(context);
  if (!client) return;
  try {
    if (action === "delete") await client.clipboard.delete(item.id);
    else if (action === "pin") await client.clipboard.pin(item.id);
    else await client.clipboard.unpin(item.id);
    stateChanged.fire();
  } catch (error) {
    reportError(error);
  }
}
