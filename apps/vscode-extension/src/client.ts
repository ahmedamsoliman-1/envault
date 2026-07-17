import { EnvaultClient } from "@envault/api-client";
import * as vscode from "vscode";

import { serverUrl, TOKEN_KEY } from "./config";

export async function getAccessToken(
  context: vscode.ExtensionContext,
): Promise<string | null> {
  return (await context.secrets.get(TOKEN_KEY)) ?? null;
}

export function createClient(token: string | null): EnvaultClient {
  return new EnvaultClient({
    baseUrl: serverUrl(),
    getAccessToken: () => Promise.resolve(token),
  });
}

/**
 * Resolves an authenticated client, or `null` (after warning the user) when no
 * device credential is stored.
 */
export async function requireClient(
  context: vscode.ExtensionContext,
): Promise<EnvaultClient | null> {
  const token = await getAccessToken(context);
  if (!token) {
    void vscode.window.showWarningMessage(
      "Sign in to Envault first (Envault: Sign in).",
    );
    return null;
  }
  return createClient(token);
}
