import type { VariableDto } from "@envault/api-contract";
import { describe, expect, it } from "vitest";

import { filterVariables } from "./variable-filters";

const now = Date.parse("2026-07-16T12:00:00.000Z");

function variable(
  id: string,
  key: string,
  visibility: VariableDto["visibility"],
  tags: string[],
  updatedAt: string,
): VariableDto {
  return {
    id,
    vaultId: "vault",
    projectId: "project",
    environmentId: "environment",
    key,
    encryptedValue: "ciphertext",
    encryptionIv: "initialization-vector",
    encryptionVersion: 1,
    visibility,
    tags,
    description: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

const variables = [
  variable(
    "one",
    "DATABASE_URL",
    "secret",
    ["database", "production"],
    "2026-07-16T08:00:00.000Z",
  ),
  variable(
    "two",
    "PUBLIC_API_URL",
    "plain",
    ["frontend"],
    "2026-07-10T08:00:00.000Z",
  ),
  variable(
    "three",
    "LEGACY_TOKEN",
    "protected",
    ["legacy"],
    "2026-05-01T08:00:00.000Z",
  ),
];

describe("filterVariables", () => {
  it("combines visibility, tag and search filters", () => {
    expect(
      filterVariables(
        variables,
        {
          search: "database",
          visibility: "secret",
          tag: "production",
          modified: "all",
        },
        now,
      ).map(({ id }) => id),
    ).toEqual(["one"]);
  });

  it("filters variables by recent modification windows", () => {
    expect(
      filterVariables(
        variables,
        {
          search: "",
          visibility: "all",
          tag: "all",
          modified: "week",
        },
        now,
      ).map(({ id }) => id),
    ).toEqual(["one", "two"]);
  });

  it("returns every variable when filters are clear", () => {
    expect(
      filterVariables(
        variables,
        {
          search: "",
          visibility: "all",
          tag: "all",
          modified: "all",
        },
        now,
      ),
    ).toHaveLength(3);
  });
});
