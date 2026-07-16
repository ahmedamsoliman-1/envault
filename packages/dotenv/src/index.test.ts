import { describe, expect, it } from "vitest";

import { parseDotenv, serializeDotenv, serializeEnvironment } from "./index";

describe("parseDotenv", () => {
  it("parses common assignments, comments, empty values, and shell exports", () => {
    const result = parseDotenv(`
# application configuration
API_URL=https://api.example.com/v1
EMPTY=
export LOG_LEVEL = debug # local override
`);

    expect(result.hasErrors).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.entries.map(({ key, value, exported }) => ({
        key,
        value,
        exported,
      })),
    ).toEqual([
      {
        key: "API_URL",
        value: "https://api.example.com/v1",
        exported: false,
      },
      { key: "EMPTY", value: "", exported: false },
      { key: "LOG_LEVEL", value: "debug", exported: true },
    ]);
  });

  it("supports single quotes, double-quoted escapes, and multiline values", () => {
    const result = parseDotenv(`
LITERAL='keep $HOME and \\n literal'
MESSAGE="hello \\"team\\"\\nsecond line"
CERTIFICATE="-----BEGIN-----
line-one
line-two
-----END-----"
`);

    expect(result.hasErrors).toBe(false);
    expect(result.entries.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: "LITERAL", value: "keep $HOME and \\n literal" },
      { key: "MESSAGE", value: 'hello "team"\nsecond line' },
      {
        key: "CERTIFICATE",
        value: "-----BEGIN-----\nline-one\nline-two\n-----END-----",
      },
    ]);
  });

  it("preserves references, hashes without preceding whitespace, and unknown escapes", () => {
    const result = parseDotenv(`
URL=https://example.com/#fragment
REFERENCE="\${BASE_URL}/v1"
UNKNOWN="keep\\qescape"
`);

    expect(result.entries.map(({ value }) => value)).toEqual([
      "https://example.com/#fragment",
      "${BASE_URL}/v1",
      "keep\\qescape",
    ]);
  });

  it("reports duplicate keys with both source locations", () => {
    const result = parseDotenv("API_URL=first\nAPI_URL=second");
    const duplicate = result.diagnostics[0];

    expect(result.hasErrors).toBe(false);
    expect(duplicate).toMatchObject({
      code: "duplicate-key",
      severity: "warning",
      key: "API_URL",
      location: { line: 2 },
      relatedLocation: { line: 1 },
    });
    expect(result.entries.map(({ value }) => value)).toEqual([
      "first",
      "second",
    ]);
  });

  it("reports invalid keys, missing assignments, and trailing quoted content", () => {
    const result = parseDotenv(`
1INVALID=value
MISSING
VALID="value" unexpected
`);

    expect(result.hasErrors).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "invalid-key",
      "missing-assignment",
      "trailing-content",
    ]);
  });

  it("reports unterminated quoted values", () => {
    const result = parseDotenv('SECRET="first line\nsecond line');

    expect(result.hasErrors).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        code: "unterminated-quote",
        severity: "error",
        key: "SECRET",
        location: { line: 1, endLine: 2 },
      },
    ]);
  });

  it("warns about shell substitutions while preserving them as literal text", () => {
    const result = parseDotenv("TOKEN=$(read-secret)\nOTHER=`whoami`");

    expect(result.hasErrors).toBe(false);
    expect(result.entries.map(({ value }) => value)).toEqual([
      "$(read-secret)",
      "`whoami`",
    ]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      "suspicious-content",
      "suspicious-content",
    ]);
  });

  it("handles a UTF-8 BOM and CRLF input", () => {
    const result = parseDotenv("\uFEFFFIRST=one\r\nSECOND=two\r\n");

    expect(result.hasErrors).toBe(false);
    expect(result.entries.map(({ key }) => key)).toEqual(["FIRST", "SECOND"]);
  });
});

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

  it("round-trips serialized entries through the parser", () => {
    const entries = [
      { key: "EMPTY", value: "" },
      { key: "REFERENCE", value: "${API_URL}/v1" },
      { key: "MESSAGE", value: 'hello "team"\nnext line' },
      { key: "WINDOWS_PATH", value: "C:\\envault\\bin" },
    ];

    const result = parseDotenv(serializeDotenv(entries));

    expect(result.hasErrors).toBe(false);
    expect(result.entries.map(({ key, value }) => ({ key, value }))).toEqual(
      entries,
    );
  });
});

describe("serializeEnvironment", () => {
  const entries = [
    { key: "API_URL", value: "https://api.example.com" },
    { key: "MESSAGE", value: "hello world" },
    { key: "UNICODE", value: "مرحباً" },
  ];

  it("serializes JSON and shell exports", () => {
    expect(serializeEnvironment(entries, "json")).toContain(
      '"MESSAGE": "hello world"',
    );
    expect(serializeEnvironment(entries, "shell")).toContain(
      "export MESSAGE='hello world'",
    );
  });

  it("serializes a Docker Compose environment mapping", () => {
    expect(serializeEnvironment(entries, "docker-compose")).toBe(
      'environment:\n  API_URL: "https://api.example.com"\n  MESSAGE: "hello world"\n  UNICODE: "مرحباً"',
    );
  });

  it("serializes Kubernetes Secret YAML with encoded values", () => {
    const result = serializeEnvironment(entries, "kubernetes-secret", {
      kubernetesSecretName: "Production API",
    });

    expect(result).toContain("name: production-api");
    expect(result).toContain("MESSAGE: aGVsbG8gd29ybGQ=");
    expect(result).toContain("UNICODE: 2YXYsdit2KjYp9mL");
  });
});
