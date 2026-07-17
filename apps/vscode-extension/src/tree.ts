import type {
  EnvironmentDto,
  ProjectDto,
  VariableDto,
} from "@keephq/api-contract";
import * as vscode from "vscode";

import { createClient, getAccessToken } from "./client";
import { stateChanged } from "./events";

interface ProjectNode {
  kind: "project";
  project: ProjectDto;
}
interface EnvironmentNode {
  kind: "environment";
  project: ProjectDto;
  environment: EnvironmentDto;
}
interface VariableNode {
  kind: "variable";
  variable: VariableDto;
}
type KeepNode = ProjectNode | EnvironmentNode | VariableNode;

export class KeepTreeProvider implements vscode.TreeDataProvider<KeepNode> {
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

  getTreeItem(node: KeepNode): vscode.TreeItem {
    if (node.kind === "project") {
      const item = new vscode.TreeItem(
        node.project.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = new vscode.ThemeIcon("folder");
      item.contextValue = "keepProject";
      return item;
    }
    if (node.kind === "environment") {
      const item = new vscode.TreeItem(
        node.environment.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.description = `${node.environment.kind} · v${node.environment.version}`;
      item.iconPath = new vscode.ThemeIcon("server-environment");
      item.contextValue = "keepEnvironment";
      item.command = {
        command: "keep.bindEnvironment",
        title: "Use this environment",
        arguments: [node.project, node.environment],
      };
      return item;
    }
    const item = new vscode.TreeItem(
      node.variable.key,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = "••••••";
    item.iconPath = new vscode.ThemeIcon("key");
    item.contextValue = "keepVariable";
    return item;
  }

  async getChildren(node?: KeepNode): Promise<KeepNode[]> {
    const token = await getAccessToken(this.context);
    if (!token) return [];
    const client = createClient(token);
    try {
      if (!node) {
        const { projects } = await client.projects.list();
        return projects.map((project) => ({ kind: "project", project }));
      }
      if (node.kind === "project") {
        const { environments } = await client.environments.list(
          node.project.id,
        );
        return environments.map((environment) => ({
          kind: "environment",
          project: node.project,
          environment,
        }));
      }
      if (node.kind === "environment") {
        const { variables } = await client.variables.list(node.environment.id);
        return variables
          .slice()
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((variable) => ({ kind: "variable", variable }));
      }
      return [];
    } catch {
      return [];
    }
  }
}
