/**
 * Visual modeler: the module spec the page edits, and its conversion to what `pnpm scaffold -- --spec` takes
 * (see apps/api/scripts/scaffold.ts, SpecFile).
 */

/** Field types in the order offered; `hint` says what it's for */
export const TYPE_OPTIONS = [
  { value: 'str', label: '文本', hint: '名称、标题、邮箱（100 字）' },
  { value: 'str50', label: '编码', hint: '编号、代码（50 字）' },
  { value: 'str20', label: '短文本', hint: '电话、颜色（20 字）' },
  { value: 'str500', label: '链接', hint: '外部 URL（500 字）' },
  { value: 'text', label: '长文本', hint: '描述、备注、正文' },
  { value: 'int', label: '整数', hint: '数量、次数、排序' },
  { value: 'float', label: '金额', hint: '价格、费用（两位小数）' },
  { value: 'bool', label: '是 / 否', hint: '启用、开关' },
  { value: 'date', label: '日期', hint: '不带时间' },
  { value: 'datetime', label: '日期时间', hint: '带时间' },
  { value: 'enum', label: '固定选项', hint: '状态、级别等几个固定值' },
  { value: 'dict', label: '字典', hint: '选项来自数据字典' },
  { value: 'image', label: '图片', hint: '照片、封面（文件中心）' },
  { value: 'file', label: '附件', hint: '合同、扫描件（文件中心）' },
]
export const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]))

/** Types a unique constraint is allowed on (same rule as the generator) */
export const UNIQUE_TYPES = new Set(['str', 'str20', 'str50', 'str500', 'text', 'int', 'float'])
/** Types that can't be required */
export const NO_REQUIRED_TYPES = new Set(['image', 'file'])

let seq = 0
/** Row key for React lists (field names change while typing) */
export const rowKey = () => `f${++seq}`

export const emptyField = (over = {}) => ({
  key: rowKey(),
  name: '',
  type: 'str',
  label: '',
  required: false,
  unique: false,
  default: '',
  options: [],
  dict: '',
  ...over,
})

export const emptySpec = () => ({
  name: '',
  title: '',
  parentId: null,
  dataScope: false,
  fields: [emptyField({ name: 'name', label: '名称', required: true })],
  i18n: { 'en-US': {}, 'ja-JP': {} },
})

/** A spec from the API (AI suggestion) → page state */
export function fromSpec(spec, previous) {
  return {
    ...(previous ?? emptySpec()),
    name: spec.name ?? '',
    title: spec.title ?? '',
    fields: (spec.fields ?? []).map((f) =>
      emptyField({
        name: f.name ?? '',
        type: f.type ?? 'str',
        label: f.label ?? '',
        required: Boolean(f.required),
        unique: Boolean(f.unique),
        default: f.default === undefined || f.default === null ? '' : String(f.default),
        options: (f.options ?? []).map((o) => ({ value: o.value ?? '', label: o.label ?? '' })),
        dict: f.dict ?? '',
      }),
    ),
    i18n: { 'en-US': { ...(spec.i18n?.['en-US'] ?? {}) }, 'ja-JP': { ...(spec.i18n?.['ja-JP'] ?? {}) } },
  }
}

/** Chinese texts that end up in the generated page and menus: title, labels, option names */
export function specTexts(spec) {
  const texts = [spec.title, ...spec.fields.flatMap((f) => [f.label, ...(f.type === 'enum' ? f.options.map((o) => o.label) : [])])]
  return [...new Set(texts.map((t) => (t ?? '').trim()).filter(Boolean))]
}

/** "device_code" → "Device Code": what the generator uses when a text has no translation */
export const titleCase = (name) =>
  String(name ?? '')
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

/** Page state → the spec file the generator takes */
export function toPayload(spec) {
  const i18n = {}
  for (const lang of ['en-US', 'ja-JP']) {
    const texts = specTexts(spec)
    i18n[lang] = Object.fromEntries(texts.filter((t) => spec.i18n[lang]?.[t]?.trim()).map((t) => [t, spec.i18n[lang][t].trim()]))
  }
  return {
    name: spec.name.trim(),
    title: spec.title.trim(),
    dataScope: spec.dataScope || undefined,
    fields: spec.fields.map((f) => ({
      name: f.name.trim(),
      type: f.type,
      ...(f.label.trim() ? { label: f.label.trim() } : {}),
      ...(f.required && !NO_REQUIRED_TYPES.has(f.type) ? { required: true } : {}),
      ...(f.unique && UNIQUE_TYPES.has(f.type) ? { unique: true } : {}),
      ...(f.default !== '' && f.default !== null ? { default: f.default } : {}),
      ...(f.type === 'enum' ? { options: f.options.map((o) => ({ value: o.value.trim(), label: o.label.trim() })) } : {}),
      ...(f.type === 'dict' ? { dict: f.dict } : {}),
    })),
    menu: spec.parentId ? { parentId: spec.parentId } : {},
    i18n,
  }
}
