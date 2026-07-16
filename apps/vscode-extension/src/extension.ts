import { EnvaultApiError, EnvaultClient } from "@envault/api-client";
import { createHash, randomBytes } from "node:crypto";
import { hostname } from "node:os";
import * as vscode from "vscode";

const tokenKey = "envault.deviceAccessToken";

function serverUrl() {
  return vscode.workspace
    .getConfiguration("envault")
    .get<string>("serverUrl", "http://localhost:3000")
    .replace(/\/$/u, "");
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("envault.signIn", async () => {
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const client = new EnvaultClient({ baseUrl: serverUrl() });
      try {
        const authorization = await client.devices.createAuthorization({
          deviceName: hostname(),
          clientName: "Envault for VS Code",
          codeChallenge: challenge,
          scopes: [
            "projects:read",
            "environments:read",
            "variables:read",
            "variables:write",
          ],
        });
        await vscode.env.openExternal(
          vscode.Uri.parse(authorization.verificationUri),
        );
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Approve Envault code ${authorization.userCode}`,
            cancellable: true,
          },
          async (_progress, cancellation) => {
            while (
              !cancellation.isCancellationRequested &&
              Date.now() < new Date(authorization.expiresAt).getTime()
            ) {
              const result = await client.devices.exchange(
                authorization.authorizationId,
                verifier,
              );
              if (result.status === "authorized") {
                await context.secrets.store(tokenKey, result.accessToken);
                void vscode.window.showInformationMessage(
                  `Envault connected as ${result.session.deviceName}.`,
                );
                return;
              }
              await sleep(authorization.intervalSeconds * 1_000);
            }
            throw new Error("Device authorization was cancelled or expired.");
          },
        );
      } catch (error) {
        const message =
          error instanceof EnvaultApiError || error instanceof Error
            ? error.message
            : "Envault sign-in failed.";
        void vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("envault.signOut", async () => {
      await context.secrets.delete(tokenKey);
      void vscode.window.showInformationMessage(
        "The local Envault device credential was removed.",
      );
    }),
    vscode.commands.registerCommand("envault.status", async () => {
      const token = await context.secrets.get(tokenKey);
      void vscode.window.showInformationMessage(
        token
          ? `Envault is connected to ${serverUrl()}.`
          : "Envault is not connected.",
      );
    }),
    vscode.commands.registerCommand("envault.selectEnvironment", async () => {
      const token = await context.secrets.get(tokenKey);
      if (!token) {
        void vscode.window.showWarningMessage(
          "Sign in to Envault before selecting an environment.",
        );
        return;
      }
      const client = new EnvaultClient({
        baseUrl: serverUrl(),
        getAccessToken: () => Promise.resolve(token),
      });
      try {
        const { projects } = await client.projects.list();
        const project = await vscode.window.showQuickPick(
          projects.map((item) => ({
            label: item.name,
            description: item.description ?? undefined,
            project: item,
          })),
          { placeHolder: "Select an Envault project" },
        );
        if (!project) return;
        const { environments } = await client.environments.list(
          project.project.id,
        );
        const environment = await vscode.window.showQuickPick(
          environments.map((item) => ({
            label: item.name,
            description: `${item.kind} · version ${item.version}`,
            environment: item,
          })),
          { placeHolder: "Select an Envault environment" },
        );
        if (!environment) return;
        await context.workspaceState.update(
          "envault.selectedProjectId",
          project.project.id,
        );
        await context.workspaceState.update(
          "envault.selectedEnvironmentId",
          environment.environment.id,
        );
        void vscode.window.showInformationMessage(
          `Envault environment selected: ${project.label} / ${environment.label}`,
        );
      } catch (error) {
        void vscode.window.showErrorMessage(
          error instanceof Error
            ? error.message
            : "The Envault environment could not be selected.",
        );
      }
    }),
  );
}

export function deactivate() {}
