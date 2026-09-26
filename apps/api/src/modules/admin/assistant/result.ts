/**
 * Fitting an API response into what the model sees without breaking its structure.
 *
 * Cutting the JSON text at a fixed length loses whole records (a role list with every role's menus is ~15k
 * characters: the model saw one role and retried the same call). Instead, shrink in steps until it fits:
 *   1. cut long strings, and shorten nested lists (a role's menus, a record's tags) to a few entries
 *   2. replace nested lists / objects inside records with a short summary
 *   3. keep only as many records of the main list as fit
 * and say what was left out, so the model answers with what it has instead of asking again.
 */

const NESTED_KEEP = 5
const STRING_KEEP = 200

type Json = unknown

const size = (value: Json) => JSON.stringify(value)?.length ?? 0
const isObject = (value: Json): value is Record<string, Json> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The response's main list: a bare array, or the `items` of a paged list */
function mainList(value: Json): Json[] | null {
  if (Array.isArray(value)) return value
  if (isObject(value) && Array.isArray(value.items)) return value.items
  return null
}

function withMainList(value: Json, list: Json[]): Json {
  return Array.isArray(value) ? list : { ...(value as Record<string, Json>), items: list }
}

/** Step 1: long strings cut, nested lists cut to a few entries (the main list itself is left alone) */
function trim(value: Json, main: boolean): Json {
  if (typeof value === 'string') return value.length > STRING_KEEP ? `${value.slice(0, STRING_KEEP)}…` : value
  if (Array.isArray(value)) {
    const kept = (main ? value : value.slice(0, NESTED_KEEP)).map((v) => trim(v, false))
    return !main && value.length > NESTED_KEEP ? [...kept, `… ${value.length - NESTED_KEEP} more`] : kept
  }
  if (isObject(value)) {
    const list = mainList(value)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trim(v, main && v === list)]))
  }
  return value
}

/** Step 2: inside each record, nested lists / objects become a summary ("12 items", "{…}") */
function flatten(record: Json): Json {
  if (!isObject(record)) return record
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, Array.isArray(v) ? `${v.length} items` : isObject(v) ? '{…}' : v]),
  )
}

export interface FittedResult {
  data: Json
  /** What was left out, for the model; absent when the whole response fits */
  note?: string
}

const AGAIN = 'Calling the same route with the same parameters returns the same result: answer with what is here, or narrow it down with query parameters the route documents (see search_api) or its detail route.'

export function fitResult(value: Json, limit: number): FittedResult {
  if (size(value) <= limit) return { data: value }

  const trimmed = trim(value, true)
  if (size(trimmed) <= limit) {
    return { data: trimmed, note: `Result shortened: nested lists cut to ${NESTED_KEEP} entries and long text cut. ${AGAIN}` }
  }

  const list = mainList(trimmed)
  if (!list) {
    const text = JSON.stringify(trimmed)
    return { data: `${text.slice(0, limit)}…`, note: `Result cut at ${limit} characters (${text.length} in total). ${AGAIN}` }
  }

  const flat = list.map(flatten)
  const summarized = withMainList(trimmed, flat)
  if (size(summarized) <= limit) {
    return { data: summarized, note: `Result shortened: nested lists and objects inside each record are summarized. ${AGAIN}` }
  }

  // Keep as many records as fit
  let kept = flat.length
  while (kept > 0 && size(withMainList(trimmed, flat.slice(0, kept))) > limit) kept = Math.floor(kept * 0.8)
  return {
    data: withMainList(trimmed, flat.slice(0, kept)),
    note: `Result shortened: only the first ${kept} of ${list.length} records are shown, with nested data summarized. ${AGAIN}`,
  }
}
