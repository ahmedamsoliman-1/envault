import type { PasswordItemDto } from "@keephq/api-contract";
import * as vscode from "vscode";

import { createClient, getAccessToken } from "./client";
import { stateChanged } from "./events";
import { decryptPasswordEntry, type PasswordEntry } from "./password-entry";
import type { VaultSession } from "./vault-session";

const MASK = "••••••••";

interface LockedNode {
  kind: "locked";
}
interface EmptyNode {
  kind: "empty";
}
interface EntryNode {
  kind: "entry";
  dto: PasswordItemDto;
  entry: PasswordEntry;
}
type PasswordNode = LockedNode | EmptyNode | EntryNode;

/**
 * Lists the vault's managed passwords. The whole entry is encrypted, so nothing
 * is shown until the vault is unlocked; when locked the view offers a single
 * "Unlock vault" row. Passwords are masked by default and revealed per row on
 * demand. Decryption happens locally with the in-memory vault key — plaintext
 * never touches disk, settings or workspace state.
 */
export class PasswordsTreeProvider implements vscode.TreeDataProvider<PasswordNode> {
  readonly #onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;

  /** Item ids the user has chosen to reveal for this session. */
  readonly #revealed = new Set<string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly session: VaultSession,
  ) {
    stateChanged.event(() => this.#onDidChangeTreeData.fire());
    session.onDidChange(() => this.#onDidChangeTreeData.fire());
    context.secrets.onDidChange((event) => {
      if (event.key === "envault.deviceAccessToken")
        this.#onDidChangeTreeData.fire();
    });
  }

  refresh(): void {
    this.#onDidChangeTreeData.fire();
  }

  toggleReveal(dto: PasswordItemDto): void {
    if (this.#revealed.has(dto.id)) this.#revealed.delete(dto.id);
    else this.#revealed.add(dto.id);
    this.#onDidChangeTreeData.fire();
  }

  getTreeItem(node: PasswordNode): vscode.TreeItem {
    if (node.kind === "locked") {
      const item = new vscode.TreeItem(
        "Unlock vault to view passwords",
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("lock");
      item.command = {
        command: "keep.passwords.unlock",
        title: "Unlock vault",
      };
      return item;
    }

    if (node.kind === "empty") {
      const item = new vscode.TreeItem(
        "No passwords yet",
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon("key");
      item.tooltip = "Add password entries from the Keep web app.";
      item.contextValue = "keepVaultEmpty";
      return item;
    }

    const { dto, entry } = node;
    const label = entry.title || entry.username || "(untitled)";
    const revealed = this.#revealed.has(dto.id);
    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = revealed ? entry.password : MASK;
    item.iconPath = new vscode.ThemeIcon(entry.favorite ? "star-full" : "key");
    item.tooltip = new vscode.MarkdownString(
      [
        entry.title ? `**${entry.title}**` : undefined,
        entry.username ? `username: ${entry.username}` : undefined,
        entry.url ? `url: ${entry.url}` : undefined,
        entry.folder ? `folder: ${entry.folder}` : undefined,
      ]
        .filter(Boolean)
        .join("  \n"),
    );
    item.contextValue = revealed ? "keepPasswordRevealed" : "keepPassword";
    return item;
  }

  async getChildren(node?: PasswordNode): Promise<PasswordNode[]> {
    if (node) return [];
    const token = await getAccessToken(this.context);
    if (!token) return [];

    const client = createClient(token);
    let items: PasswordItemDto[];
    try {
      const list = await client.passwords.list();
      items = list.items;
    } catch {
      return [];
    }
    const first = items[0];
    if (!first) {
      // No entries yet: reflect lock state so a signed-in user never sees the
      // "sign in" welcome by mistake.
      return [this.session.isUnlocked ? { kind: "empty" } : { kind: "locked" }];
    }

    const key = this.session.getKey(first.vaultId);
    if (!key) return [{ kind: "locked" }];

    try {
      const entries = await Promise.all(
        items.map(async (dto) => ({
          kind: "entry" as const,
          dto,
          entry: await decryptPasswordEntry(key, dto),
        })),
      );
      return entries.sort((a, b) =>
        (a.entry.title || a.entry.username).localeCompare(
          b.entry.title || b.entry.username,
        ),
      );
    } catch {
      // A decryption failure (e.g. a stale key for a rotated vault) is reported
      // as a locked state so the user can re-unlock.
      return [{ kind: "locked" }];
    } finally {
      key.fill(0);
    }
  }
}

/** Copies the entry's password into the OS clipboard. */
export async function copyPassword(node: unknown): Promise<void> {
  const entry = (node as EntryNode | undefined)?.entry;
  if (!entry) return;
  await vscode.env.clipboard.writeText(entry.password);
  void vscode.window.showInformationMessage(
    "Password copied to your clipboard.",
  );
}

/** Copies the entry's username into the OS clipboard. */
export async function copyUsername(node: unknown): Promise<void> {
  const entry = (node as EntryNode | undefined)?.entry;
  if (!entry) return;
  if (!entry.username) {
    void vscode.window.showWarningMessage("This entry has no username.");
    return;
  }
  await vscode.env.clipboard.writeText(entry.username);
  void vscode.window.showInformationMessage(
    "Username copied to your clipboard.",
  );
}

/** Toggles the masked/revealed state of the entry's password in the tree. */
export function revealPassword(
  provider: PasswordsTreeProvider,
  node: unknown,
): void {
  const dto = (node as EntryNode | undefined)?.dto;
  if (!dto) return;
  provider.toggleReveal(dto);
}
