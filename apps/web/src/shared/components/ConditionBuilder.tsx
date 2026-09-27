import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { Filter, FolderPlus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTx } from '@/i18n'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/shared/components/DatePicker'
import MultiSelect from '@/shared/components/MultiSelect'
import SegmentedTabs from '@/shared/components/SegmentedTabs'

/** How the conditions of one level combine */
export type ConditionLogic = 'AND' | 'OR'

/** Decides the operators offered and the value editor */
export type ConditionFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'not_contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'not_empty'

/**
 * A condition's value, by operator:
 * - empty / not_empty: null
 * - between: [min, max] (number | null for numbers, 'YYYY-MM-DD' | '' for dates; null / '' leaves that end open)
 * - in / not_in: the chosen option values
 * - otherwise one value: string (text / date 'YYYY-MM-DD' / select), number | null (number), boolean (boolean)
 */
export type ConditionItemValue = string | number | boolean | null | (string | number | null)[]

export interface ConditionFieldOption {
  /** Chinese source text (translated here) */
  label: string
  value: string | number
}

export interface ConditionField<K extends string = string> {
  /** The field name written into the conditions */
  key: K
  /** Chinese source text (translated here) */
  label: string
  type: ConditionFieldType
  /** Choices for a select field */
  options?: readonly ConditionFieldOption[]
  /** Limits the operators offered (a subset of the type's operators, in this order) */
  operators?: readonly ConditionOperator[]
}

export interface ConditionItem<K extends string = string> {
  field: K
  operator: ConditionOperator
  value: ConditionItemValue
}

export interface ConditionGroup<K extends string = string> {
  logic: ConditionLogic
  items: ConditionItem<K>[]
}

/** The builder's value: top-level conditions and groups, combined with `logic`; plain JSON, ready to send to an API */
export interface ConditionTree<K extends string = string> {
  logic: ConditionLogic
  items: ConditionItem<K>[]
  groups: ConditionGroup<K>[]
}

export interface ConditionBuilderProps<K extends string = string> {
  /** The fields a condition can test; at least one is needed to add conditions */
  fields: readonly ConditionField<K>[]
  value: ConditionTree<K>
  onChange: (value: ConditionTree<K>) => void
  /** Offer condition groups (one nested level with its own AND / OR); default true */
  allowGroups?: boolean
  disabled?: boolean
  className?: string
}

/** Operators per field type; the first is the default for a new condition */
const TYPE_OPERATORS: Record<ConditionFieldType, readonly ConditionOperator[]> = {
  text: ['contains', 'not_contains', 'eq', 'ne', 'empty', 'not_empty'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'empty', 'not_empty'],
  date: ['eq', 'lt', 'gt', 'between', 'empty', 'not_empty'],
  select: ['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty'],
  boolean: ['eq'],
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: '等于',
  ne: '不等于',
  contains: '包含',
  not_contains: '不包含',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  between: '在范围内',
  in: '属于',
  not_in: '不属于',
  empty: '为空',
  not_empty: '不为空',
}

/** Dates read better as before / after */
const DATE_OPERATOR_LABELS: Partial<Record<ConditionOperator, string>> = { lt: '早于', gt: '晚于' }

const LOGIC_ITEMS = [
  { value: 'AND' as const, label: '满足全部' },
  { value: 'OR' as const, label: '满足任一' },
]

const operatorsOf = (field: ConditionField): readonly ConditionOperator[] => {
  const allowed = TYPE_OPERATORS[field.type]
  const picked = field.operators?.filter((op) => allowed.includes(op))
  return picked?.length ? picked : allowed
}

const operatorLabel = (op: ConditionOperator, type: ConditionFieldType) => (type === 'date' && DATE_OPERATOR_LABELS[op]) || OPERATOR_LABELS[op]

type ValueShape = 'none' | 'range' | 'list' | 'single'

const shapeOf = (op: ConditionOperator): ValueShape =>
  op === 'empty' || op === 'not_empty' ? 'none' : op === 'between' ? 'range' : op === 'in' || op === 'not_in' ? 'list' : 'single'

/** The empty value for a field type and operator */
function initialValue(type: ConditionFieldType, op: ConditionOperator): ConditionItemValue {
  switch (shapeOf(op)) {
    case 'none':
      return null
    case 'range':
      return type === 'date' ? ['', ''] : [null, null]
    case 'list':
      return []
    default:
      return type === 'number' ? null : type === 'boolean' ? true : ''
  }
}

function newItem<K extends string>(field: ConditionField<K>): ConditionItem<K> {
  const operator = operatorsOf(field)[0] ?? 'eq'
  return { field: field.key, operator, value: initialValue(field.type, operator) }
}

/** Parses a number input: '' → null */
const toNumber = (text: string): number | null => (text.trim() === '' || Number.isNaN(Number(text)) ? null : Number(text))

/** [min, max] of a range value, each end as-is or null */
function rangeOf(value: ConditionItemValue): [string | number | null, string | number | null] {
  return Array.isArray(value) ? [value[0] ?? null, value[1] ?? null] : [null, null]
}

/**
 * React keys for the rows, kept by position next to the value. The value is plain data without ids (and form libraries
 * hand back copies of it on every change), so keys can't live on the objects: they are added and removed together with
 * the rows here, and fitted to the value's lengths when it changes from outside (a reset, a loaded query).
 */
interface RowKeys {
  items: string[]
  groups: { key: string; items: string[] }[]
}

let keySeq = 0
const newKey = () => `c${++keySeq}`

/** `keys` cut or extended to `count` */
const fitKeys = (keys: readonly string[], count: number): string[] =>
  keys.length === count ? [...keys] : [...keys.slice(0, count), ...Array.from({ length: Math.max(0, count - keys.length) }, newKey)]

const keysFit = (keys: RowKeys, value: ConditionTree<string>) =>
  keys.items.length === value.items.length &&
  keys.groups.length === value.groups.length &&
  keys.groups.every((g, i) => g.items.length === value.groups[i]?.items.length)

function fitRowKeys(keys: RowKeys, value: ConditionTree<string>): RowKeys {
  const groupKeys = fitKeys(
    keys.groups.map((g) => g.key),
    value.groups.length,
  )
  return {
    items: fitKeys(keys.items, value.items.length),
    groups: value.groups.map((group, i) => ({ key: groupKeys[i] ?? newKey(), items: fitKeys(keys.groups[i]?.items ?? [], group.items.length) })),
  }
}

const withoutIndex = <T,>(list: readonly T[], index: number): T[] => list.filter((_, i) => i !== index)

const rowMotion = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: EASE_OUT },
} as const

/**
 * Condition builder: conditions (field, operator, value) combined with AND / OR, plus optional condition groups with
 * their own AND / OR. Controlled and data-agnostic: it only edits `value`; saving it or turning it into a query or a
 * filter is the caller's job.
 *   const FIELDS: ConditionField<'name' | 'amount'>[] = [{ key: 'name', label: '名称', type: 'text' }, …]
 *   const [value, setValue] = useState<ConditionTree<'name' | 'amount'>>({ logic: 'AND', items: [], groups: [] })
 *   <ConditionBuilder fields={FIELDS} value={value} onChange={setValue} />
 */
export default function ConditionBuilder<K extends string>({
  fields,
  value,
  onChange,
  allowGroups = true,
  disabled = false,
  className,
}: ConditionBuilderProps<K>) {
  const { t } = useTranslation()
  const [keys, setKeys] = useState<RowKeys>(() => fitRowKeys({ items: [], groups: [] }, value))
  // A value changed from outside with a different number of rows: fit the keys (adjusting state while rendering)
  if (!keysFit(keys, value)) setKeys(fitRowKeys(keys, value))

  const first = fields[0]
  const canAdd = Boolean(first) && !disabled

  /** Every structural change updates the value and its keys together */
  const change = (next: ConditionTree<K>, nextKeys: RowKeys) => {
    setKeys(nextKeys)
    onChange(next)
  }

  const addItem = () => {
    if (first) change({ ...value, items: [...value.items, newItem(first)] }, { ...keys, items: [...keys.items, newKey()] })
  }
  const removeItem = (index: number) =>
    change({ ...value, items: withoutIndex(value.items, index) }, { ...keys, items: withoutIndex(keys.items, index) })
  const addGroup = () => {
    if (first)
      change(
        { ...value, groups: [...value.groups, { logic: 'AND', items: [newItem(first)] }] },
        { ...keys, groups: [...keys.groups, { key: newKey(), items: [newKey()] }] },
      )
  }
  const removeGroup = (index: number) =>
    change({ ...value, groups: withoutIndex(value.groups, index) }, { ...keys, groups: withoutIndex(keys.groups, index) })
  const setGroup = (index: number, group: ConditionGroup<K>, itemKeys?: string[]) => {
    const groups = value.groups.map((g, i) => (i === index ? group : g))
    if (!itemKeys) return onChange({ ...value, groups })
    change({ ...value, groups }, { ...keys, groups: keys.groups.map((g, i) => (i === index ? { ...g, items: itemKeys } : g)) })
  }

  const empty = value.items.length === 0 && value.groups.length === 0
  const connector = value.logic === 'OR' ? t('或') : t('且')

  return (
    <div className={cn('@container space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedTabs
          variant="pill"
          value={value.logic}
          items={LOGIC_ITEMS}
          className={cn(disabled && 'pointer-events-none opacity-60')}
          onChange={(logic) => {
            if (!disabled) onChange({ ...value, logic })
          }}
        />
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={addItem}>
            <Plus />
            {t('新增条件')}
          </Button>
          {allowGroups ? (
            <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={addGroup}>
              <FolderPlus />
              {t('新增条件组')}
            </Button>
          ) : null}
        </div>
      </div>

      {empty ? (
        <div className="text-muted-foreground flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-8 text-center text-xs">
          <Filter className="size-4 opacity-70" />
          {t('暂无条件，点击“新增条件”开始配置')}
        </div>
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {value.items.map((item, index) => (
              <motion.div key={keys.items[index] ?? index} {...rowMotion} className="overflow-hidden">
                {index > 0 ? <Connector text={connector} /> : null}
                <ConditionRow
                  fields={fields}
                  item={item}
                  disabled={disabled}
                  onChange={(next) => onChange({ ...value, items: value.items.map((it, i) => (i === index ? next : it)) })}
                  onRemove={() => removeItem(index)}
                />
              </motion.div>
            ))}
            {value.groups.map((group, index) => (
              <motion.div key={keys.groups[index]?.key ?? `g${index}`} {...rowMotion} className="overflow-hidden">
                {index > 0 || value.items.length > 0 ? <Connector text={connector} /> : null}
                <GroupCard
                  fields={fields}
                  group={group}
                  itemKeys={keys.groups[index]?.items ?? []}
                  disabled={disabled}
                  onChange={(next, itemKeys) => setGroup(index, next, itemKeys)}
                  onRemove={() => removeGroup(index)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function Connector({ text }: { text: string }) {
  return <div className="text-muted-foreground py-1 pl-2 text-[11px] font-medium tracking-wide uppercase">{text}</div>
}

interface GroupCardProps<K extends string> {
  fields: readonly ConditionField<K>[]
  group: ConditionGroup<K>
  /** Keys of the group's rows, by position */
  itemKeys: readonly string[]
  disabled: boolean
  /** itemKeys is passed when rows were added or removed */
  onChange: (group: ConditionGroup<K>, itemKeys?: string[]) => void
  onRemove: () => void
}

function GroupCard<K extends string>({ fields, group, itemKeys, disabled, onChange, onRemove }: GroupCardProps<K>) {
  const { t } = useTranslation()
  const first = fields[0]
  const connector = group.logic === 'OR' ? t('或') : t('且')
  const addItem = () => {
    if (first) onChange({ ...group, items: [...group.items, newItem(first)] }, [...itemKeys, newKey()])
  }
  return (
    <div role="group" aria-label={t('条件组')} className="bg-muted/30 space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{t('条件组')}</span>
          <SegmentedTabs
            variant="pill"
            value={group.logic}
            items={LOGIC_ITEMS}
            className={cn('bg-background', disabled && 'pointer-events-none opacity-60')}
            onChange={(logic) => {
              if (!disabled) onChange({ ...group, logic })
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" disabled={disabled || !first} onClick={addItem}>
            <Plus />
            {t('新增条件')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('删除条件组')}
            disabled={disabled}
            onClick={onRemove}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {group.items.length === 0 ? <p className="text-muted-foreground py-2 text-center text-xs">{t('组内还没有条件')}</p> : null}
      <AnimatePresence initial={false}>
        {group.items.map((item, index) => (
          <motion.div key={itemKeys[index] ?? index} {...rowMotion} className="overflow-hidden">
            {index > 0 ? <Connector text={connector} /> : null}
            <ConditionRow
              fields={fields}
              item={item}
              disabled={disabled}
              onChange={(next) => onChange({ ...group, items: group.items.map((it, i) => (i === index ? next : it)) })}
              onRemove={() => onChange({ ...group, items: withoutIndex(group.items, index) }, withoutIndex(itemKeys, index))}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

interface ConditionRowProps<K extends string> {
  fields: readonly ConditionField<K>[]
  item: ConditionItem<K>
  disabled: boolean
  onChange: (item: ConditionItem<K>) => void
  onRemove: () => void
}

function ConditionRow<K extends string>({ fields, item, disabled, onChange, onRemove }: ConditionRowProps<K>) {
  const { t } = useTranslation()
  const tx = useTx()
  const field = fields.find((f) => f.key === item.field)
  const operators = field ? operatorsOf(field) : []

  const changeField = (key: string) => {
    const next = fields.find((f) => f.key === key)
    if (next && next.key !== item.field) onChange(newItem(next))
  }
  const changeOperator = (op: ConditionOperator) => {
    if (!field) return
    // Keep the value while its shape fits the new operator (e.g. eq → ne), reset it otherwise
    const keep = shapeOf(op) === shapeOf(item.operator)
    onChange({ ...item, operator: op, value: keep ? item.value : initialValue(field.type, op) })
  }

  return (
    // Narrow: field | operator | delete on one line, the value below; wide (container ≥ 36rem): one line
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 @xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_auto]">
      <Select value={item.field} onValueChange={changeField} disabled={disabled}>
        <SelectTrigger aria-label={t('字段')} className="w-full">
          <SelectValue placeholder={t('选择字段')} />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {tx(f.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={item.operator}
        onValueChange={(op) => {
          const picked = operators.find((o) => o === op)
          if (picked) changeOperator(picked)
        }}
        disabled={disabled || !field}
      >
        <SelectTrigger aria-label={t('操作符')} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op}>
              {t(operatorLabel(op, field?.type ?? 'text'))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="order-last col-span-3 min-w-0 @xl:order-none @xl:col-span-1">
        {field ? <ValueEditor field={field} item={item} disabled={disabled} onChange={(v) => onChange({ ...item, value: v })} /> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('删除条件')}
        disabled={disabled}
        onClick={onRemove}
        className="text-muted-foreground hover:text-danger"
      >
        <Trash2 />
      </Button>
    </div>
  )
}

interface ValueEditorProps {
  field: ConditionField
  item: ConditionItem
  disabled: boolean
  onChange: (value: ConditionItemValue) => void
}

function ValueEditor({ field, item, disabled, onChange }: ValueEditorProps) {
  const { t } = useTranslation()
  const tx = useTx()
  const shape = shapeOf(item.operator)
  const options = field.options ?? []

  if (shape === 'none') {
    return <div className="text-muted-foreground flex h-9 items-center px-1 text-xs">{t('无需填写值')}</div>
  }

  if (shape === 'range') {
    const [min, max] = rangeOf(item.value)
    if (field.type === 'date') {
      return (
        <RangeInputs
          from={<DatePicker value={typeof min === 'string' ? min : ''} onChange={(v) => onChange([v, typeof max === 'string' ? max : ''])} placeholder="开始日期" disabled={disabled} />}
          to={<DatePicker value={typeof max === 'string' ? max : ''} onChange={(v) => onChange([typeof min === 'string' ? min : '', v])} placeholder="结束日期" disabled={disabled} />}
        />
      )
    }
    return (
      <RangeInputs
        from={<NumberInput value={min} onChange={(v) => onChange([v, max])} placeholder={t('最小值')} disabled={disabled} />}
        to={<NumberInput value={max} onChange={(v) => onChange([min, v])} placeholder={t('最大值')} disabled={disabled} />}
      />
    )
  }

  if (shape === 'list') {
    const selected = Array.isArray(item.value) ? item.value.filter((v): v is string | number => v !== null) : []
    return <MultiSelect options={options} value={selected} onChange={onChange} disabled={disabled} />
  }

  switch (field.type) {
    case 'number':
      return <NumberInput value={item.value} onChange={onChange} placeholder={t('输入条件值')} disabled={disabled} />
    case 'date':
      return <DatePicker value={typeof item.value === 'string' ? item.value : ''} onChange={onChange} disabled={disabled} />
    case 'boolean':
      return (
        <Select value={item.value === false ? 'false' : 'true'} onValueChange={(v) => onChange(v === 'true')} disabled={disabled}>
          <SelectTrigger aria-label={t('值')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t('是')}</SelectItem>
            <SelectItem value="false">{t('否')}</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'select':
      return (
        <Select
          value={item.value === null || typeof item.value === 'object' ? '' : String(item.value)}
          onValueChange={(v) => {
            // Radix works with strings: hand back the option's own value (numbers stay numbers)
            const option = options.find((o) => String(o.value) === v)
            if (option) onChange(option.value)
          }}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t('值')} className="w-full">
            <SelectValue placeholder={t('请选择')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>
                {tx(o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    default:
      return (
        <Input
          aria-label={t('值')}
          value={typeof item.value === 'string' || typeof item.value === 'number' ? String(item.value) : ''}
          placeholder={t('输入条件值')}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )
  }
}

/** The two ends of a range side by side, stacked when the cell is too narrow for both */
function RangeInputs({ from, to }: { from: ReactNode; to: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <div className="min-w-40 flex-1">{from}</div>
      <div className="min-w-40 flex-1">{to}</div>
    </div>
  )
}

interface NumberInputProps {
  value: ConditionItemValue
  onChange: (value: number | null) => void
  placeholder: string
  disabled: boolean
}

function NumberInput({ value, onChange, placeholder, disabled }: NumberInputProps) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      aria-label={placeholder}
      value={typeof value === 'number' ? value : ''}
      placeholder={placeholder}
      onChange={(e) => onChange(toNumber(e.target.value))}
      disabled={disabled}
      className="tabular-nums"
    />
  )
}
