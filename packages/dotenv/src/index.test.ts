import { describe, expect, it } from "vitest";

import { serializeDotenv } from "./index";

describe("serializeDotenv", () => {
  it("serializes common values without unnecessary quotes", () => {
    expect(
      serializeDotenv([
        { key: "API_URL", value: "https://api.example.com/v1" },
        { key: "LOG_LEVEL", value: "debug" },
        { key: "EMPTY", value: "" },
      ]),
    ).toBe("API_URL=https://api.example.com/v1\nLOG_LEVEL=debug\nEMPTY=");
  });

  it("quotes whitespace, newlines, quotes, and backslashes", () => {
    expect(
      serializeDotenv([{ key: "MESSAGE", value: 'hello "team"\nC:\\envault' }]),
    ).toBe('MESSAGE="hello \\"team\\"\\nC:\\\\envault"');
  });
});
