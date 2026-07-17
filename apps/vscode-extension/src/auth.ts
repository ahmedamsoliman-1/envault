import { EnvaultApiError, EnvaultClient } from "@envault/api-client";
import { createHash, randomBytes } from "node:crypto";
import { hostname } from "node:os";
import * as vscode from "vscode";

import { createClient, getAccessToken } from "./client";
import { serverUrl, TOKEN_KEY } from "./config";
import { forgetDeviceKey } from "./unlock";
import type { VaultSession } from "./vault-session";

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function signIn(context: vscode.ExtensionContext): Promise<void> {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
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
            await context.secrets.store(TOKEN_KEY, result.accessToken);
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
}

export async function signOut(
  context: vscode.ExtensionContext,
  session: VaultSession,
): Promise<void> {
  session.lock();
  const token = await getAccessToken(context);
  await forgetDeviceKey(context, token ? createClient(token) : null);
  await context.secrets.delete(TOKEN_KEY);
  void vscode.window.showInformationMessage(
    "Signed out of Envault. The local device credential was removed.",
  );
}

export async function showStatus(
  context: vscode.ExtensionContext,
  session: VaultSession,
): Promise<void> {
  const token = await getAccessToken(context);
  if (!token) {
    void vscode.window.showInformationMessage("Envault is not connected.");
    return;
  }
  void vscode.window.showInformationMessage(
    session.isUnlocked
      ? `Envault is connected to ${serverUrl()} and unlocked.`
      : `Envault is connected to ${serverUrl()} (vault locked).`,
  );
}
