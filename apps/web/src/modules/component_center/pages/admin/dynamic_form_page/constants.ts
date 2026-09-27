import type { DynamicFormPageItem } from '@/modules/component_center/api/dynamic_form_page'

/** Dynamic-field sub-table constants and form types (shared by the page and FieldRowsEditor) */

/** One row of the dynamic-field sub-table as the form holds it (values are always strings, like the field_value text column) */
export interface FieldRow {
  field_key: string
  field_value: string
  field_type: string
  remark: string
}

/** What the record dialog holds */
export interface DynamicFormValues {
  title: string
  record_code: string
  category: string
  status: DynamicFormPageItem['status']
  owner: string
  /** null once the number input is cleared */
  priority: number | null
  is_active: boolean
  description: string
  fields: FieldRow[]
}

export const MAX_FIELDS = 20
export const EMPTY_FIELD_ROW: FieldRow = { field_key: '', field_value: '', field_type: 'text', remark: '' }
export const FIELD_TYPE_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
]
