import * as vscode from "vscode";

/**
 * Fires whenever connection, lock or environment-selection state changes, so the
 * status bar and tree view can refresh from a single signal.
 */
export const stateChanged = new vscode.EventEmitter<void>();
