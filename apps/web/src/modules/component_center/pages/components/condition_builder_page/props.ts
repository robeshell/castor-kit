import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** ConditionBuilder (ConditionBuilderProps in shared/components/ConditionBuilder.tsx) */
export const CONDITION_BUILDER_PROPS: readonly PropDoc[] = [
  { name: 'fields', type: 'readonly ConditionField<K>[]', description: '可以作为条件的字段，见下方 ConditionField；新条件默认用第一个字段' },
  { name: 'value', type: 'ConditionTree<K>', description: '当前条件（受控），纯 JSON，可以直接保存或提交' },
  { name: 'onChange', type: '(value: ConditionTree<K>) => void', description: '任何修改后调用，传入新的完整值' },
  { name: 'allowGroups', type: 'boolean', default: 'true', description: '显示「新增条件组」；false 时只有一层条件' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只读：显示条件但不能修改' },
  { name: 'className', type: 'string', description: '外层容器的 class' },
]

/** One testable field (ConditionField<K>) */
export const CONDITION_FIELD_PROPS: readonly PropDoc[] = [
  { name: 'key', type: 'K', description: '写进条件的字段名；K 通常是字段名的联合类型' },
  { name: 'label', type: 'string', description: '下拉框里的名称（中文原文，组件内翻译）' },
  { name: 'type', type: "'text' | 'number' | 'date' | 'select' | 'boolean'", description: '决定可选的操作符和值的输入方式' },
  { name: 'options', type: 'readonly { label, value }[]', description: 'select 字段的选项；label 为中文原文' },
  { name: 'operators', type: 'readonly ConditionOperator[]', description: '只提供这些操作符（该类型操作符的子集，按给定顺序）' },
]

/** The value: ConditionTree<K>, ConditionGroup<K> and ConditionItem<K> */
export const CONDITION_TREE_PROPS: readonly PropDoc[] = [
  { name: 'logic', type: "'AND' | 'OR'", description: '这一层的条件和条件组怎样组合：满足全部或满足任一' },
  { name: 'items', type: 'ConditionItem<K>[]', description: '这一层的条件：{ field, operator, value }' },
  { name: 'groups', type: 'ConditionGroup<K>[]', description: '条件组：{ logic, items }，只有一层嵌套' },
  { name: 'item.value', type: 'ConditionItemValue', description: 'between 为 [最小, 最大]，in / not_in 为数组，为空 / 不为空为 null，其余为单个值' },
]

/** Operators per field type (the first is the default for a new condition) */
export const OPERATOR_ROWS: readonly PropDoc[] = [
  { name: 'text', type: 'contains, not_contains, eq, ne, empty, not_empty', default: "''", description: '文本输入框' },
  { name: 'number', type: 'eq, ne, gt, gte, lt, lte, between, empty, not_empty', default: 'null', description: '数字输入框；between 为两个输入框' },
  { name: 'date', type: 'eq, lt, gt, between, empty, not_empty', default: "''", description: "DatePicker，值为 'YYYY-MM-DD'；lt / gt 显示为早于 / 晚于" },
  { name: 'select', type: 'eq, ne, in, not_in, empty, not_empty', default: "''", description: '下拉选择；in / not_in 为多选，值保持选项原本的类型' },
  { name: 'boolean', type: 'eq', default: 'true', description: '是 / 否' },
]
