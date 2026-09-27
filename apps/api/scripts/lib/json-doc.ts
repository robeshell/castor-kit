/**
 * The format of JSON documents kept in the repository (docs/apifox-full.openapi.json): two-space indentation, non-ASCII
 * as-is, a trailing newline. Parsing and re-formatting a document written this way gives the same bytes, so the scripts
 * that edit it (openapi:generate, scaffold) only change what they touch.
 */
export function formatJsonDoc(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** A copy of an object with its keys sorted (the document's paths) */
export function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}
