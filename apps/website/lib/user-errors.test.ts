import { EnvaultApiError } from "@envault/api-client";
import { describe, expect, it } from "vitest";

import { getEnvironmentConflict } from "./user-errors";

describe("getEnvironmentConflict", () => {
  it("extracts expected and current environment versions", () => {
    expect(
      getEnvironmentConflict(
        new EnvaultApiError(
          409,
          {
            code: "ENVIRONMENT_VERSION_CONFLICT",
            message: "The environment changed.",
            details: { expectedVersion: 4, currentVersion: 6 },
          },
          "request-id",
        ),
      ),
    ).toEqual({ expectedVersion: 4, currentVersion: 6 });
  });

  it("ignores unrelated errors", () => {
    expect(getEnvironmentConflict(new Error("offline"))).toBeNull();
  });
});
