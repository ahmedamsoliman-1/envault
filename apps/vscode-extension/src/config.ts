import * as vscode from "vscode";

export const DEFAULT_SERVER_URL = "https://env.aamsdn.space";

/** SecretStorage key for the revocable device access token. */
export const TOKEN_KEY = "envault.deviceAccessToken";

/** SecretStorage key for the local device secret used to silently unwrap the vault key. */
export const DEVICE_SECRET_KEY = "envault.deviceVaultSecret";

export function serverUrl(): string {
  return vscode.workspace
    .getConfiguration("envault")
    .get<string>("serverUrl", DEFAULT_SERVER_URL)
    .replace(/\/$/u, "");
}

export function autoLockMinutesOverride(): number | null {
  const value = vscode.workspace
    .getConfiguration("envault")
    .get<number>("autoLockMinutes", 0);
  return typeof value === "number" && value > 0 ? value : null;
}
