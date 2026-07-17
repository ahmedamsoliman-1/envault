import type { VariableDto } from "@envault/api-contract";
import { describe, expect, it } from "vitest";

import { buildPushPlan, planHasChanges } from "./push-plan";

function remoteVar(
  id: string,
  key: string,
  overrides: Partial<VariableDto> = {},
): VariableDto {
  return {
    id,
    vaultId: "vault-1",
    projectId: "project-1",
    environmentId: "env-1",
    key,
    encryptedValue: "cipher",
    encryptionIv: "iv",
    encryptionVersion: 1,
    visibility: "secret",
    tags: [],
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPushPlan", () => {
  it("classifies new, updated, unchanged, remote-only and invalid keys", () => {
    const remote = [
      remoteVar("id-keep", "KEEP"),
      remoteVar("id-change", "CHANGE"),
      remoteVar("id-remote", "REMOTE_ONLY"),
    ];
    const decrypted = new Map([
      ["id-keep", "same"],
      ["id-change", "old"],
      ["id-remote", "value"],
    ]);
    const source = [
      "NEW_KEY=fresh",
      "KEEP=same",
      "CHANGE=new",
      "BAD.KEY=nope",
    ].join("\n");

    const plan = buildPushPlan(source, remote, decrypted);

    expect(plan.create.map((entry) => entry.key)).toEqual(["NEW_KEY"]);
    expect(plan.update.map((entry) => entry.existing.key)).toEqual(["CHANGE"]);
    expect(plan.update[0]?.value).toBe("new");
    expect(plan.unchangedCount).toBe(1);
    expect(plan.remoteOnly).toEqual(["REMOTE_ONLY"]);
    expect(plan.invalid.map((entry) => entry.key)).toEqual(["BAD.KEY"]);
    expect(planHasChanges(plan)).toBe(true);
  });

  it("matches keys case-insensitively and reuses the remote id for updates", () => {
    const remote = [remoteVar("id-1", "API_URL")];
    const decrypted = new Map([["id-1", "http://old"]]);

    const plan = buildPushPlan("api_url=http://new", remote, decrypted);

    expect(plan.create).toHaveLength(0);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0]?.existing.id).toBe("id-1");
  });

  it("reports no changes when the file matches remote", () => {
    const remote = [remoteVar("id-1", "TOKEN")];
    const decrypted = new Map([["id-1", "abc"]]);

    const plan = buildPushPlan("TOKEN=abc", remote, decrypted);

    expect(planHasChanges(plan)).toBe(false);
    expect(plan.unchangedCount).toBe(1);
  });

  it("surfaces dotenv warnings without treating them as changes", () => {
    const remote: VariableDto[] = [];
    const plan = buildPushPlan("DUP=1\nDUP=2", remote, new Map());

    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.create).toHaveLength(1);
  });
});
