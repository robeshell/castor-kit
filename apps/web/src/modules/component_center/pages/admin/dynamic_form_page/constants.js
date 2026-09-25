/** Dynamic-field sub-table constants (shared by the page and FieldRowsEditor) */
export const MAX_FIELDS = 20
export const EMPTY_FIELD_ROW = { field_key: '', field_value: '', field_type: 'text', remark: '' }
export const FIELD_TYPE_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
]
