import { describe, expect, it } from "vitest";

import {
  bulkEnvironmentRequestSchema,
  importEnvironmentRequestSchema,
} from "./index";

const encryptedVariable = {
  id: "d9c7048d-94fc-4faf-b6a5-61f36c6b46aa",
  projectId: "project",
  key: "API_URL",
  encryptedValue: "ciphertext",
  encryptionIv: "initialization-vector",
  encryptionVersion: 1 as const,
  visibility: "secret" as const,
  tags: [],
  description: null,
};

describe("importEnvironmentRequestSchema", () => {
  it("accepts a bounded encrypted import chunk", () => {
    expect(
      importEnvironmentRequestSchema.safeParse({
        operationId: "98937168-2245-4cc0-a719-9ae9f69698f7",
        expectedVersion: 3,
        variables: [encryptedVariable],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate keys inside one chunk", () => {
    expect(
      importEnvironmentRequestSchema.safeParse({
        operationId: "98937168-2245-4cc0-a719-9ae9f69698f7",
        expectedVersion: 3,
        variables: [
          encryptedVariable,
          {
            ...encryptedVariable,
            id: "479338c5-d54c-49b8-a87f-44c55043d980",
            key: "api_url",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("bulkEnvironmentRequestSchema", () => {
  it("requires at least one mutation", () => {
    expect(
      bulkEnvironmentRequestSchema.safeParse({
        operationId: "98937168-2245-4cc0-a719-9ae9f69698f7",
        expectedVersion: 3,
        updates: [],
        deleteIds: [],
      }).success,
    ).toBe(false);
  });

  it("rejects a variable appearing in updates and deletes", () => {
    expect(
      bulkEnvironmentRequestSchema.safeParse({
        operationId: "98937168-2245-4cc0-a719-9ae9f69698f7",
        expectedVersion: 3,
        updates: [{ id: "variable", visibility: "protected" }],
        deleteIds: ["variable"],
      }).success,
    ).toBe(false);
  });
});
