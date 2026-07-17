import type { ImportVariableItem, VariableDto } from "@envault/api-contract";
import { parseDotenv } from "@envault/dotenv";

import { encryptVariable } from "./crypto";

/** The API accepts a stricter key shape than the dotenv parser tolerates. */
const API_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;

export interface PushPlan {
  create: { key: string; value: string }[];
  update: { existing: VariableDto; value: string }[];
  unchangedCount: number;
  invalid: { key: string; reason: string }[];
  remoteOnly: string[];
  warnings: string[];
}

/**
 * Classifies a parsed dotenv file against the current remote variables. Never
 * deletes: keys present only remotely are reported and left untouched. Requires
 * decrypted remote values (to distinguish updated from unchanged).
 */
export function buildPushPlan(
  source: string,
  remote: VariableDto[],
  decryptedRemote: Map<string, string>,
): PushPlan {
  const parsed = parseDotenv(source);
  const remoteByKey = new Map(
    remote.map((item) => [item.key.toUpperCase(), item]),
  );

  // Collapse duplicate keys the way dotenv does — last declaration wins — so a
  // single value per key reaches the API (which rejects duplicates in a chunk).
  const localByKey = new Map<string, { key: string; value: string }>();
  for (const entry of parsed.entries) {
    localByKey.set(entry.key.toUpperCase(), {
      key: entry.key,
      value: entry.value,
    });
  }
  const localKeys = new Set(localByKey.keys());

  const plan: PushPlan = {
    create: [],
    update: [],
    unchangedCount: 0,
    invalid: [],
    remoteOnly: [],
    warnings: parsed.diagnostics
      .filter((diagnostic) => diagnostic.severity === "warning")
      .map((diagnostic) => diagnostic.message),
  };

  for (const entry of localByKey.values()) {
    if (!API_KEY_PATTERN.test(entry.key)) {
      plan.invalid.push({
        key: entry.key,
        reason: "Key contains characters the server does not accept.",
      });
      continue;
    }
    const existing = remoteByKey.get(entry.key.toUpperCase());
    if (!existing) {
      plan.create.push({ key: entry.key, value: entry.value });
      continue;
    }
    const currentValue = decryptedRemote.get(existing.id);
    if (currentValue === entry.value) {
      plan.unchangedCount += 1;
    } else {
      plan.update.push({ existing, value: entry.value });
    }
  }

  for (const item of remote) {
    if (!localKeys.has(item.key.toUpperCase())) plan.remoteOnly.push(item.key);
  }

  return plan;
}

export function planHasChanges(plan: PushPlan): boolean {
  return plan.create.length > 0 || plan.update.length > 0;
}

export interface PlanContext {
  vaultId: string;
  projectId: string;
  environmentId: string;
}

/** Encrypts every create/update in the plan into API import items. */
export async function encodePlanItems(
  plan: PushPlan,
  vaultKey: Uint8Array,
  context: PlanContext,
  newId: () => string,
): Promise<ImportVariableItem[]> {
  const items: ImportVariableItem[] = [];

  for (const entry of plan.create) {
    const id = newId();
    const { encryptedValue, encryptionIv } = await encryptVariable(vaultKey, {
      vaultId: context.vaultId,
      projectId: context.projectId,
      environmentId: context.environmentId,
      variableId: id,
      value: entry.value,
    });
    items.push({
      id,
      projectId: context.projectId,
      key: entry.key,
      encryptedValue,
      encryptionIv,
      encryptionVersion: 1,
      visibility: "secret",
      tags: [],
      description: null,
    });
  }

  for (const { existing, value } of plan.update) {
    const { encryptedValue, encryptionIv } = await encryptVariable(vaultKey, {
      vaultId: context.vaultId,
      projectId: context.projectId,
      environmentId: context.environmentId,
      variableId: existing.id,
      value,
    });
    items.push({
      id: existing.id,
      projectId: context.projectId,
      key: existing.key,
      encryptedValue,
      encryptionIv,
      encryptionVersion: 1,
      visibility: existing.visibility,
      tags: existing.tags,
      description: existing.description,
    });
  }

  return items;
}
