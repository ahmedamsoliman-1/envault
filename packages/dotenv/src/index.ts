export interface DotenvEntry {
  key: string;
  value: string;
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
