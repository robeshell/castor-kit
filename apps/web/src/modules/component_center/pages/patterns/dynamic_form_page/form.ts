import type { DemoRecord } from '@/modules/component_center/api/demo_record'
import type { DemoCategory, DemoStatus } from '@/modules/component_center/pages/patterns/demo-record-options'

/**
 * Dynamic fields: how the record's `extra` object maps to the form's field rows (shared by the page and
 * FieldRowsEditor).
 *
 * Stored: `extra` is a plain `{ key: value }` object with native JSON values (text, number, boolean, dates as
 * 'YYYY-MM-DD', null when blank). The type isn't stored: toFieldRows infers it from the value, so a text value that
 * looks like a date reads back as a date. The form rows keep every value as the input's text; toFieldRows / toExtra
 * convert at the API boundary.
 */

export const FIELD_TYPES = ['text', 'number', 'boolean', 'date'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'date', label: '日期' },
]

/** One dynamic field as the form holds it: value is text ('true' / 'false' for booleans, YYYY-MM-DD for dates) */
export interface FieldRow {
  key: string
  type: FieldType
  value: string
}

/** What the record dialog holds: the fixed columns plus the dynamic field rows */
export interface FormValues {
  name: string
  code: string
  category: DemoCategory | null
  status: DemoStatus | null
  owner: string
  is_active: boolean
  description: string
  fields: FieldRow[]
}

export const MAX_FIELDS = 20
export const EMPTY_FIELD_ROW: FieldRow = { key: '', type: 'text', value: '' }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** The type a stored value reads back as */
function typeOf(value: unknown): FieldType {
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string' && DATE_PATTERN.test(value)) return 'date'
  return 'text'
}

/** Stored `extra` → form rows. `extra` is any JSON object: a nested value shows as its JSON text (and is saved back as text) */
export function toFieldRows(extra: DemoRecord['extra']): FieldRow[] {
  return Object.entries(extra).map(([key, value]) => {
    let text = ''
    if (typeof value === 'string') text = value
    else if (typeof value === 'number' || typeof value === 'boolean') text = String(value)
    else if (value !== null && value !== undefined) text = JSON.stringify(value)
    return { key, type: typeOf(value), value: text }
  })
}

/** Form rows → the whole `extra` object: blank keys are dropped, values converted to their type (blank → null) */
export function toExtra(rows: FieldRow[]): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    rows
      .filter((row) => row.key.trim())
      .map(({ key, type, value }) => {
        const text = value.trim()
        if (type === 'boolean') return [key.trim(), text === 'true']
        if (text === '') return [key.trim(), null]
        return [key.trim(), type === 'number' ? Number(text) : text]
      }),
  )
}
