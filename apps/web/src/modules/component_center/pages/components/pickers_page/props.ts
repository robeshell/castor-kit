import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** MultiSelect (MultiSelectProps<V> in shared/components/MultiSelect.tsx) */
export const MULTI_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'readonly V[]', default: '[]', description: '选中的值（受控），V 为 string 或 number' },
  { name: 'onChange', type: '(value: V[]) => void', description: '勾选或移除时调用，传入新的数组' },
  { name: 'options', type: 'readonly MultiSelectOption<V>[]', default: '[]', description: '选项 { label, value }，label 为中文原文' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'请选择'", description: '未选时的文字（中文原文，组件内翻译）' },
  { name: 'maxShown', type: 'number', default: '3', description: '最多显示几个标签，其余折叠成 +N' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
  { name: 'className', type: 'string', description: '触发按钮的 class' },
]

/** TagInput (TagInputProps in shared/components/TagInput.tsx) */
export const TAG_INPUT_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'readonly string[]', default: '[]', description: '标签（受控）' },
  { name: 'onChange', type: '(value: string[]) => void', description: '添加或删除时调用；添加时按逗号拆分、去掉首尾空格并去重' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'输入后回车添加'", description: '没有标签时的占位文字' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用，隐藏删除按钮' },
  { name: 'className', type: 'string', description: '外层 class' },
]

/** DatePicker (DatePickerProps in shared/components/DatePicker.tsx) */
export const DATE_PICKER_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | null', description: "'YYYY-MM-DD'（更长的字符串取前 10 位）；'' / null 为空" },
  { name: 'onChange', type: '(value: string) => void', description: "传入 'YYYY-MM-DD'，清空时为 ''" },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'选择日期'", description: '未选时的文字（中文原文，组件内翻译）' },
  { name: 'clearable', type: 'boolean', default: 'true', description: '有值时显示清空按钮' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
  { name: 'className', type: 'string', description: '触发按钮的 class' },
]

/** DateTimePicker (DateTimePickerProps) */
export const DATE_TIME_PICKER_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | null', description: "接口时间（ISO 8601，例如 UTC 的 …Z）；'' / null 为空" },
  { name: 'onChange', type: '(value: string) => void', description: "传入带浏览器时区偏移的 ISO 8601（接口转成 UTC），清空时为 ''" },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
  { name: 'className', type: 'string', description: '外层 class' },
]

/** TreeSelect (TreeSelectProps<Id> in shared/components/TreeSelect.tsx) */
export const TREE_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'value', type: "Id | '' | null", description: "选中节点的 id（受控）；null / '' 为未选" },
  { name: 'onChange', type: '(id: Id | null) => void', description: '选中或清空时调用' },
  { name: 'tree', type: 'readonly TreeSelectNode<Id>[]', default: '[]', description: '节点树，见下方 TreeSelectNode' },
  { name: 'excludeId', type: 'Id | null', description: '隐藏该节点和它的子孙，例如编辑时选上级，避免循环' },
  { name: 'noneLabel', type: 'string', description: '设置后第一项可以选空（null）' },
  { name: 'codeKey', type: 'string', default: "'code'", description: '显示在名称旁、也参与搜索的节点字段' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'请选择'", description: '未选时的文字' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'searchPlaceholder', type: 'string', default: "'搜索名称 / 编码'", description: '搜索框占位文字' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'emptyText', type: 'string', default: "'没有匹配的项'", description: '搜索无结果时的文字' },
  { name: 'clearable', type: 'boolean', default: 'true', description: '有值时显示清空按钮' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
  { name: 'className', type: 'string', description: '触发按钮的 class；其余属性（id / aria-*）传给触发按钮' },
]

/** One TreeSelect node (TreeSelectNode<Id>) */
export const TREE_SELECT_NODE_PROPS: readonly PropDoc[] = [
  { name: 'id', type: 'Id extends string | number', description: '选中时的值' },
  { name: 'name', type: 'string', description: '显示的名称（数据，不翻译）；触发按钮显示完整路径' },
  { name: 'code', type: 'string | null', description: '编码，显示在名称旁并参与搜索' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '显示但不可选' },
  { name: 'children', type: 'readonly TreeSelectNode<Id>[] | null', description: '子节点' },
]
