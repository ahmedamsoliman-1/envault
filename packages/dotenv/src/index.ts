export interface DotenvEntry {
  key: string;
  value: string;
}

export interface DotenvSourceLocation {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ParsedDotenvEntry extends DotenvEntry {
  exported: boolean;
  location: DotenvSourceLocation;
}

export type DotenvDiagnosticSeverity = "error" | "warning";

export type DotenvDiagnosticCode =
  | "duplicate-key"
  | "invalid-key"
  | "missing-assignment"
  | "suspicious-content"
  | "trailing-content"
  | "unterminated-quote";

export interface DotenvDiagnostic {
  code: DotenvDiagnosticCode;
  severity: DotenvDiagnosticSeverity;
  message: string;
  location: DotenvSourceLocation;
  key?: string;
  relatedLocation?: DotenvSourceLocation;
}

export interface ParseDotenvResult {
  entries: ParsedDotenvEntry[];
  diagnostics: DotenvDiagnostic[];
  hasErrors: boolean;
}

const validKeyPattern = /^[A-Za-z_][A-Za-z0-9_.-]*$/u;

function location(
  line: number,
  column: number,
  endLine = line,
  endColumn = column,
): DotenvSourceLocation {
  return { line, column, endLine, endColumn };
}

function decodeDoubleQuotedEscape(character: string): string {
  switch (character) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case '"':
      return '"';
    case "\\":
      return "\\";
    default:
      return `\\${character}`;
  }
}

function findUnquotedComment(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (
      value[index] === "#" &&
      (index === 0 || /\s/u.test(value[index - 1] ?? ""))
    ) {
      return index;
    }
  }

  return -1;
}

function suspiciousContentLocation(
  value: string,
  startLine: number,
  startColumn: number,
): DotenvSourceLocation | null {
  const match = /(?:\$\(|`)/u.exec(value);
  if (!match || match.index === undefined) return null;

  const prefix = value.slice(0, match.index);
  const lineOffset = prefix.split("\n").length - 1;
  const finalLinePrefix = prefix.slice(prefix.lastIndexOf("\n") + 1);

  return location(
    startLine + lineOffset,
    lineOffset === 0
      ? startColumn + finalLinePrefix.length
      : finalLinePrefix.length + 1,
  );
}

export function parseDotenv(source: string): ParseDotenvResult {
  const lines = source
    .replace(/^\uFEFF/u, "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  const entries: ParsedDotenvEntry[] = [];
  const diagnostics: DotenvDiagnostic[] = [];
  const firstLocationsByKey = new Map<string, DotenvSourceLocation>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const sourceLine = lines[lineIndex] ?? "";
    let cursor = 0;

    while (cursor < sourceLine.length && /\s/u.test(sourceLine[cursor] ?? "")) {
      cursor += 1;
    }

    if (cursor >= sourceLine.length || sourceLine[cursor] === "#") continue;

    let exported = false;
    if (
      sourceLine.slice(cursor, cursor + 6) === "export" &&
      /\s/u.test(sourceLine[cursor + 6] ?? "")
    ) {
      exported = true;
      cursor += 6;
      while (
        cursor < sourceLine.length &&
        /\s/u.test(sourceLine[cursor] ?? "")
      ) {
        cursor += 1;
      }
    }

    const keyStart = cursor;
    while (
      cursor < sourceLine.length &&
      sourceLine[cursor] !== "=" &&
      !/\s/u.test(sourceLine[cursor] ?? "")
    ) {
      cursor += 1;
    }
    const key = sourceLine.slice(keyStart, cursor);

    while (cursor < sourceLine.length && /\s/u.test(sourceLine[cursor] ?? "")) {
      cursor += 1;
    }

    if (!validKeyPattern.test(key)) {
      diagnostics.push({
        code: "invalid-key",
        severity: "error",
        message: key
          ? `"${key}" is not a valid environment-variable key.`
          : "An environment-variable key is required.",
        location: location(
          lineIndex + 1,
          keyStart + 1,
          lineIndex + 1,
          cursor + 1,
        ),
        ...(key ? { key } : {}),
      });
      continue;
    }

    if (sourceLine[cursor] !== "=") {
      diagnostics.push({
        code: "missing-assignment",
        severity: "error",
        message: `Expected "=" after "${key}".`,
        location: location(lineIndex + 1, cursor + 1),
        key,
      });
      continue;
    }

    cursor += 1;
    while (
      cursor < sourceLine.length &&
      /[ \t]/u.test(sourceLine[cursor] ?? "")
    ) {
      cursor += 1;
    }

    const valueStartLine = lineIndex + 1;
    const valueStartColumn = cursor + 1;
    const quote = sourceLine[cursor];
    let value = "";
    let endLine = lineIndex + 1;
    let endColumn = sourceLine.length + 1;

    if (quote === '"' || quote === "'") {
      cursor += 1;
      let currentLineIndex = lineIndex;
      let currentLine = sourceLine;
      let closed = false;

      while (currentLineIndex < lines.length) {
        if (cursor >= currentLine.length) {
          if (currentLineIndex + 1 >= lines.length) break;
          value += "\n";
          currentLineIndex += 1;
          currentLine = lines[currentLineIndex] ?? "";
          cursor = 0;
          continue;
        }

        const character = currentLine[cursor] ?? "";
        if (character === quote) {
          closed = true;
          cursor += 1;
          endLine = currentLineIndex + 1;
          endColumn = cursor + 1;
          lineIndex = currentLineIndex;
          break;
        }

        if (quote === '"' && character === "\\") {
          const escaped = currentLine[cursor + 1];
          if (escaped !== undefined) {
            value += decodeDoubleQuotedEscape(escaped);
            cursor += 2;
            continue;
          }
        }

        value += character;
        cursor += 1;
      }

      if (!closed) {
        diagnostics.push({
          code: "unterminated-quote",
          severity: "error",
          message: `The quoted value for "${key}" is not terminated.`,
          location: location(
            valueStartLine,
            valueStartColumn,
            lines.length,
            (lines.at(-1)?.length ?? 0) + 1,
          ),
          key,
        });
        break;
      }

      const trailingLine = lines[lineIndex] ?? "";
      while (
        cursor < trailingLine.length &&
        /[ \t]/u.test(trailingLine[cursor] ?? "")
      ) {
        cursor += 1;
      }
      if (cursor < trailingLine.length && trailingLine[cursor] !== "#") {
        diagnostics.push({
          code: "trailing-content",
          severity: "error",
          message: `Unexpected content after the quoted value for "${key}".`,
          location: location(
            lineIndex + 1,
            cursor + 1,
            lineIndex + 1,
            trailingLine.length + 1,
          ),
          key,
        });
        continue;
      }
    } else {
      const rawValue = sourceLine.slice(cursor);
      const commentIndex = findUnquotedComment(rawValue);
      value = (
        commentIndex >= 0 ? rawValue.slice(0, commentIndex) : rawValue
      ).trimEnd();
    }

    const entryLocation = location(
      valueStartLine,
      keyStart + 1,
      endLine,
      endColumn,
    );
    const firstLocation = firstLocationsByKey.get(key);
    if (firstLocation) {
      diagnostics.push({
        code: "duplicate-key",
        severity: "warning",
        message: `"${key}" is declared more than once; the last value will take precedence.`,
        location: entryLocation,
        key,
        relatedLocation: firstLocation,
      });
    } else {
      firstLocationsByKey.set(key, entryLocation);
    }

    const suspiciousLocation = suspiciousContentLocation(
      value,
      valueStartLine,
      valueStartColumn,
    );
    if (suspiciousLocation) {
      diagnostics.push({
        code: "suspicious-content",
        severity: "warning",
        message: `"${key}" contains shell command-substitution syntax. It is preserved as literal text and will not be executed.`,
        location: suspiciousLocation,
        key,
      });
    }

    entries.push({ key, value, exported, location: entryLocation });
  }

  return {
    entries,
    diagnostics,
    hasErrors: diagnostics.some(({ severity }) => severity === "error"),
  };
}

function serializeValue(value: string): string {
  if (value === "") return "";
  if (/^[A-Za-z0-9_./:@+-]+$/u.test(value)) return value;

  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")}"`;
}

export function serializeDotenv(entries: readonly DotenvEntry[]): string {
  return entries
    .map(({ key, value }) => `${key}=${serializeValue(value)}`)
    .join("\n");
}

export type EnvironmentExportFormat =
  "dotenv" | "json" | "shell" | "docker-compose" | "kubernetes-secret";

export interface EnvironmentExportOptions {
  kubernetesSecretName?: string;
}

function shellQuote(value: string): string {
  if (value === "") return "''";
  if (/^[A-Za-z0-9_./:@%+=,-]+$/u.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function yamlDoubleQuote(value: string): string {
  return JSON.stringify(value);
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function kubernetesName(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9.-]+/gu, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gu, "")
    .slice(0, 253);
  return normalized || "envault-environment";
}

export function serializeEnvironment(
  entries: readonly DotenvEntry[],
  format: EnvironmentExportFormat,
  options: EnvironmentExportOptions = {},
): string {
  switch (format) {
    case "dotenv":
      return serializeDotenv(entries);
    case "json":
      return JSON.stringify(
        Object.fromEntries(entries.map(({ key, value }) => [key, value])),
        null,
        2,
      );
    case "shell":
      return entries
        .map(({ key, value }) => `export ${key}=${shellQuote(value)}`)
        .join("\n");
    case "docker-compose":
      return [
        "environment:",
        ...entries.map(
          ({ key, value }) => `  ${key}: ${yamlDoubleQuote(value)}`,
        ),
      ].join("\n");
    case "kubernetes-secret":
      return [
        "apiVersion: v1",
        "kind: Secret",
        "metadata:",
        `  name: ${kubernetesName(options.kubernetesSecretName ?? "")}`,
        "type: Opaque",
        "data:",
        ...entries.map(({ key, value }) => `  ${key}: ${base64Encode(value)}`),
      ].join("\n");
  }
}
