/**
 * The demo_records enums, shared by the page-pattern pages: value types from the API, options for the filters and
 * the forms (FilterSelect / FormSelect translate the labels), and the StatusBadge tone of each value, so every
 * pattern shows a status in the same color.
 *
 * Labels are the Chinese source text (the i18n key): pages pass them to components that translate them, or call
 * t(label). Each page that renders a label keeps it in its own locales/.
 */
import type { DemoRecord } from '@/modules/component_center/api/demo_record'
import type { StatusTone } from '@/shared/components/StatusBadge'

export type DemoStatus = NonNullable<DemoRecord['status']>
export type DemoCategory = NonNullable<DemoRecord['category']>
/** is_active as the filters send it (the API reads 'true' / 'false'; '' = all is the select's own empty value) */
export type DemoEnabled = 'true' | 'false'

/** One enum value: label = Chinese source text, tone = its StatusBadge color */
export interface DemoOption<V extends string> {
  value: V
  label: string
  tone: StatusTone
}

// Records keyed by the API types: tsc fails here when the API gains a value
const STATUS_META: Record<DemoStatus, { label: string; tone: StatusTone }> = {
  todo: { label: '待办', tone: 'warning' },
  in_progress: { label: '进行中', tone: 'info' },
  done: { label: '已完成', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
}
const CATEGORY_META: Record<DemoCategory, { label: string; tone: StatusTone }> = {
  product: { label: '产品', tone: 'brand' },
  design: { label: '设计', tone: 'info' },
  engineering: { label: '研发', tone: 'success' },
  marketing: { label: '市场', tone: 'warning' },
  operations: { label: '运营', tone: 'neutral' },
}
const ENABLED_META: Record<DemoEnabled, { label: string; tone: StatusTone }> = {
  true: { label: '启用', tone: 'success' },
  false: { label: '停用', tone: 'neutral' },
}

/** Statuses in workflow order */
export const STATUSES: readonly DemoStatus[] = ['todo', 'in_progress', 'done', 'archived']
const CATEGORIES: readonly DemoCategory[] = ['product', 'design', 'engineering', 'marketing', 'operations']
const ENABLED: readonly DemoEnabled[] = ['true', 'false']

export const STATUS_OPTIONS: readonly DemoOption<DemoStatus>[] = STATUSES.map((value) => ({ value, ...STATUS_META[value] }))
export const CATEGORY_OPTIONS: readonly DemoOption<DemoCategory>[] = CATEGORIES.map((value) => ({ value, ...CATEGORY_META[value] }))
/** is_active filter options (the API reads true / false) and the badge of each value */
export const ENABLED_OPTIONS: readonly DemoOption<DemoEnabled>[] = ENABLED.map((value) => ({ value, ...ENABLED_META[value] }))

export const isStatus = (value: unknown): value is DemoStatus => STATUSES.some((s) => s === value)

/** The option of a status; undefined for null / unknown values */
export const statusOption = (value: unknown) => STATUS_OPTIONS.find((o) => o.value === value)
export const statusLabel = (value: DemoStatus) => STATUS_META[value].label
export const statusTone = (value: DemoStatus) => STATUS_META[value].tone

/** The option of a category; undefined for null / unknown values */
export const categoryOption = (value: unknown) => CATEGORY_OPTIONS.find((o) => o.value === value)
export const categoryLabel = (value: unknown): string | undefined => categoryOption(value)?.label

/** The enabled / disabled option of an is_active value */
export const enabledOption = (active: boolean): DemoOption<DemoEnabled> => {
  const value = active ? 'true' : 'false'
  return { value, ...ENABLED_META[value] }
}
