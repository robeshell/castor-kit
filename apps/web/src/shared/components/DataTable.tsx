import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useTx } from '@/i18n'
import { titleIfAnyTruncated } from '@/lib/title-if-truncated'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'
import { useIsScrollable } from '@/shared/hooks/useIsScrollable'

/**
 * Data table. Column definitions:
 *   columns = [
 *     { key: 'username', title: '用户名', dataIndex: 'username', width: 200 },
 *     { key: 'status', title: '状态', render: (value, row, index) => <StatusBadge …/> },
 *     { key: 'actions', title: '', align: 'right', width: 120, render: (_, row) => <RowActions …/> },
 *   ]
 *
 * props:
 *   data / columns / rowKey (default 'id') / loading
 *   pagination = { page, perPage, total, onChange(page) }   // omit to hide pagination
 *   selectable + selectedKeys + onSelectionChange(keys, rows)
 *   onRowClick(row) / isRowActive(row) / rowClassName(row) / emptyTitle / emptyDescription / emptyAction
 *   filtered + onClearFilters: an empty result under search / filters shows "no matches" with a clear-filters button
 *   bordered (default true: outer card border) / dense (compact row height)
 */
/** A row's identity: React key and the selection value */
export type RowKey = string | number

interface DataTableColumnBase {
  /** React key; defaults to dataIndex, then the column index */
  key?: string
  /** Chinese source text (translated here) or a node */
  title?: ReactNode
  width?: CSSProperties['width']
  minWidth?: CSSProperties['minWidth']
  align?: 'left' | 'center' | 'right'
  /** Body cell class */
  className?: string
  headerClassName?: string
  /** Single line with an ellipsis (any clipped cell shows its full text as a tooltip on hover) */
  ellipsis?: boolean
  /**
   * 'end': stick to the right edge while the table scrolls sideways (row actions stay in reach on narrow screens).
   * Use it for every actions column.
   */
  pin?: 'end'
  /**
   * With onRowClick: this column's cell holds the row's button (keyboard and screen-reader access to the row click).
   * Default: the first column. Pick a column that names the row (name, title, code) and has no controls of its own.
   */
  primary?: boolean
}

/** A column that reads `row[dataIndex]`: render gets that field's value */
export interface DataTableFieldColumn<Row, K extends keyof Row> extends DataTableColumnBase {
  dataIndex: K
  render?(value: Row[K], record: Row, index: number): ReactNode
}

/** A column without dataIndex (actions, computed cells): render gets undefined as the value */
export interface DataTableRenderColumn<Row> extends DataTableColumnBase {
  dataIndex?: undefined
  render?(value: undefined, record: Row, index: number): ReactNode
}

/**
 * Column definition. Annotate the array so render's parameters are typed from the row:
 *   const columns: DataTableColumn<User>[] = [{ key: 'status', title: '状态', dataIndex: 'status', render: (value, record) => … }]
 * A column without render shows the raw value (empty → '-').
 */
export type DataTableColumn<Row extends object = Record<string, unknown>> =
  | { [K in keyof Row & string]-?: DataTableFieldColumn<Row, K> }[keyof Row & string]
  | DataTableRenderColumn<Row>

/** A column as the table reads it: any field, value unknown (render is a method, so every DataTableColumn is assignable) */
interface ErasedColumn<Row> extends DataTableColumnBase {
  dataIndex?: keyof Row & string
  render?(value: unknown, record: Row, index: number): ReactNode
}

/** Pagination settings; loading is derived by the table */
export type DataTablePagination = Omit<DataPaginationProps, 'loading'>

export interface DataTableProps<Row extends object = Record<string, unknown>, TKey extends RowKey = RowKey> {
  data?: readonly Row[]
  columns?: readonly DataTableColumn<NoInfer<Row>>[]
  /** Field name or function giving each row's key (default 'id'; a row without it falls back to its index) */
  rowKey?: (keyof NoInfer<Row> & string) | ((row: NoInfer<Row>, index: number) => TKey)
  /** Shows skeleton rows while there is no data yet, dims the rows otherwise */
  loading?: boolean
  /** Omit to hide pagination */
  pagination?: DataTablePagination
  /** Checkbox column */
  selectable?: boolean
  selectedKeys?: readonly TKey[]
  onSelectionChange?: (keys: TKey[], rows: NoInfer<Row>[]) => void
  /** Row click (the whole row for the pointer; a button in the primary column for the keyboard) */
  onRowClick?: (row: NoInfer<Row>, index: number) => void
  /** The row the page shows as current (e.g. the master row whose details are open): announced as aria-current */
  isRowActive?: (row: NoInfer<Row>, index: number) => boolean
  rowClassName?: (row: NoInfer<Row>, index: number) => string | undefined
  /** Chinese source text (translated here) or a node */
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  /** The next step when there is no data yet, usually the page's create button */
  emptyAction?: ReactNode
  /**
   * Search or filters are narrowing the list: an empty result then reads as "no matches" with a clear-filters button
   * (onClearFilters) instead of the no-data-yet empty state above
   */
  filtered?: boolean
  /** Clears the search and filters (usually the FilterBar's reset) */
  onClearFilters?: () => void
  /** Outer card border (default true) */
  bordered?: boolean
  /** Compact row height */
  dense?: boolean
  className?: string
  /** Table min width; narrower containers scroll horizontally */
  minWidth?: CSSProperties['minWidth']
}

/** Skeleton bar widths: staggered by row and column so rows don't all look identical like a barcode */
const SKELETON_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/4', 'w-2/5', 'w-3/5']
function skeletonWidth(row: number, col: number) {
  return SKELETON_WIDTHS[(row * 7 + col * 3) % SKELETON_WIDTHS.length]
}

/**
 * A pinned cell is opaque (the scrolled columns pass underneath) and paints the row's hover / selected / active tint
 * as a background image over the card color, so it matches the translucent tint on the rest of the row.
 */
const PINNED_CELL = [
  'bg-card sticky end-0 z-[1] shadow-[inset_1px_0_0_var(--border)]',
  'group-hover/row:bg-[linear-gradient(color-mix(in_oklab,var(--muted)_40%,transparent),color-mix(in_oklab,var(--muted)_40%,transparent))]',
  'group-data-[state=selected]/row:bg-[linear-gradient(var(--brand-soft),var(--brand-soft))]',
  'group-data-[active]/row:bg-[linear-gradient(var(--brand-soft),var(--brand-soft))]',
].join(' ')

export default function DataTable<Row extends object = Record<string, unknown>, TKey extends RowKey = RowKey>({
  data = [],
  columns = [],
  rowKey,
  loading = false,
  pagination,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  onRowClick,
  isRowActive,
  rowClassName,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyAction,
  filtered = false,
  onClearFilters,
  bordered = true,
  dense = false,
  className,
  minWidth,
}: DataTableProps<Row, TKey>) {
  const tx = useTx()
  const getKey = (row: Row, index: number): TKey => {
    if (typeof rowKey === 'function') return rowKey(row, index)
    const value = rowKey === undefined ? ('id' in row ? row.id : undefined) : row[rowKey]
    // A field key yields whatever the row holds there; the page picks rowKey / selectedKeys to match
    return (value ?? index) as TKey
  }
  const keySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const pageKeys = data.map(getKey)
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => keySet.has(k))
  const someSelected = !allSelected && pageKeys.some((k) => keySet.has(k))

  const toggleAll = (checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      const next = Array.from(new Set([...selectedKeys, ...pageKeys]))
      onSelectionChange(next, data.filter((row, i) => next.includes(getKey(row, i))))
    } else {
      const next = selectedKeys.filter((k) => !pageKeys.includes(k))
      onSelectionChange(next, [])
    }
  }
  const toggleOne = (row: Row, index: number, checked: boolean) => {
    if (!onSelectionChange) return
    const key = getKey(row, index)
    const next = checked ? [...selectedKeys, key] : selectedKeys.filter((k) => k !== key)
    onSelectionChange(next, data.filter((r, i) => next.includes(getKey(r, i))))
  }

  const [scrollRef, scrollable] = useIsScrollable<HTMLDivElement>()
  // Rows fade in on the first load only; paging and filtering swap them in place (a replayed entrance reads as a reload).
  // The flag flips once the first entrance has had time to finish, so removing the classes doesn't cut it short.
  const [entered, setEntered] = useState(false)
  const hasRows = data.length > 0 && !loading
  useEffect(() => {
    if (entered || !hasRows) return undefined
    const timer = window.setTimeout(() => setEntered(true), 800)
    return () => window.clearTimeout(timer)
  }, [entered, hasRows])
  const animateRows = !entered
  const rowHeight = dense ? 'h-10' : 'h-12'
  const primaryIndex = Math.max(
    0,
    columns.findIndex((col: ErasedColumn<Row>) => col.primary),
  )
  const skeletonRows = Math.min(Math.max(pagination?.perPage || 8, 5), 10)

  return (
    <div className={cn(bordered && 'surface-card', 'overflow-hidden', className)}>
      {/* Focusable while it scrolls sideways, so the keyboard can scroll it too */}
      <div
        ref={scrollRef}
        tabIndex={scrollable ? 0 : undefined}
        role={scrollable ? 'region' : undefined}
        aria-label={scrollable ? tx('表格（可横向滚动）') : undefined}
        className="focus-visible:outline-ring overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <table aria-busy={loading || undefined} className="w-full caption-bottom text-[13px]" style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr className="bg-muted/40 border-b">
              {selectable ? (
                <th className="w-10 px-3">
                  <Checkbox
                    aria-label={tx('全选')}
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                </th>
              ) : null}
              {columns.map((col: ErasedColumn<Row>, j) => (
                <th
                  key={col.key || col.dataIndex || j}
                  style={col.width ? { width: col.width, minWidth: col.minWidth } : col.minWidth ? { minWidth: col.minWidth } : undefined}
                  className={cn(
                    'text-muted-foreground h-9 px-3 text-left text-xs font-medium whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.pin === 'end' && PINNED_CELL,
                    col.headerClassName,
                  )}
                >
                  {col.title ? tx(col.title) : col.key === 'actions' ? <span className="sr-only">{tx('操作')}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && data.length === 0
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={`sk-${i}`} className={cn('border-b last:border-0', rowHeight)}>
                    {selectable ? (
                      <td className="w-10 px-3">
                        <Skeleton className="size-4 rounded-[4px]" />
                      </td>
                    ) : null}
                    {columns.map((col: ErasedColumn<Row>, j) => (
                      <td key={col.key || col.dataIndex || j} className="px-3">
                        <Skeleton className={cn('h-3.5', skeletonWidth(i, j), col.align === 'right' && 'ml-auto')} />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row, index) => {
                  const key = getKey(row, index)
                  const selected = keySet.has(key)
                  const active = isRowActive?.(row, index) ?? false
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                      data-state={selected ? 'selected' : undefined}
                      data-active={active || undefined}
                      style={animateRows ? { animationDelay: `${Math.min(index, 12) * 18}ms` } : undefined}
                      className={cn(
                        'group/row border-b transition-colors duration-150 last:border-0',
                        animateRows && 'animate-in fade-in-0 slide-in-from-bottom-0.5 fill-mode-both',
                        'hover:bg-muted/40 data-[state=selected]:bg-brand-soft',
                        onRowClick && 'cursor-pointer',
                        loading && 'opacity-60',
                        rowHeight,
                        rowClassName?.(row, index),
                      )}
                    >
                      {selectable ? (
                        <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={tx('选择')}
                            checked={selected}
                            onCheckedChange={(v) => toggleOne(row, index, v === true)}
                          />
                        </td>
                      ) : null}
                      {columns.map((col: ErasedColumn<Row>, j) => {
                        const value = col.dataIndex ? row[col.dataIndex] : undefined
                        // Without render the raw value is shown: the column's field has to hold something renderable
                        const content = col.render ? col.render(value, row, index) : (value as ReactNode)
                        const empty = content === null || content === undefined || content === ''
                        const shown = empty ? <span className="text-muted-foreground/60">-</span> : content
                        return (
                          <td
                            key={col.key || col.dataIndex || j}
                            className={cn(
                              'px-3 py-2 align-middle',
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              col.ellipsis && 'max-w-0 truncate',
                              col.pin === 'end' && PINNED_CELL,
                              col.className,
                            )}
                            // Clipped text anywhere in the cell (ellipsis columns, truncated spans from render) shows in full on hover
                            onMouseEnter={titleIfAnyTruncated}
                          >
                            {onRowClick && j === primaryIndex ? (
                              // No handler of its own: Enter / Space click it, and the click bubbles to the row's onClick
                              <button
                                type="button"
                                aria-current={active || undefined}
                                className={cn(
                                  'focus-visible:outline-ring w-full cursor-pointer rounded-sm [text-align:inherit] focus-visible:outline-2 focus-visible:outline-offset-2',
                                  col.ellipsis && 'truncate',
                                )}
                              >
                                {shown}
                              </button>
                            ) : (
                              shown
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      {!loading && data.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="没有符合条件的记录"
            description="换个关键词或筛选条件试试"
            action={
              onClearFilters ? (
                <Button size="sm" variant="outline" onClick={onClearFilters}>
                  {tx('清除筛选')}
                </Button>
              ) : null
            }
          />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )
      ) : null}
      {pagination ? <DataPagination {...pagination} loading={loading && data.length === 0} /> : null}
    </div>
  )
}

function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined && p - prev > 1) result.push('…')
    result.push(p)
  })
  return result
}

export interface DataPaginationProps {
  /** 1-based */
  page?: number
  perPage?: number
  total?: number
  onChange?: (page: number) => void
  /** Hides the range text (first load) */
  loading?: boolean
  className?: string
}

/** Pagination bar: N total · page numbers · previous/next */
export function DataPagination({ page = 1, perPage = 20, total = 0, onChange, loading = false, className }: DataPaginationProps) {
  const { t } = useTranslation()
  // A non-positive (or NaN) page size would divide by zero: treat everything as one page
  const size = perPage > 0 ? perPage : Math.max(total, 1)
  const totalPages = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(page * size, total)
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t px-3 py-2.5 text-xs', className)}>
      {/* A stable live region: the range is announced after a page change or a new search */}
      <span role="status" className="text-muted-foreground tabular-nums">
        {loading ? '\u00a0' : total === 0 ? t('共 0 条') : t('第 {{from}}–{{to}} 条，共 {{total}} 条', { from, to, total })}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={page <= 1}
          onClick={() => onChange?.(page - 1)}
          aria-label={t('上一页')}
        >
          <ChevronLeft />
        </Button>
        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="text-muted-foreground px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={t('第 {{page}} 页', { page: p })}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange?.(p)}
              className={cn(
                'h-7 min-w-7 rounded-md px-1.5 tabular-nums transition-colors',
                p === page ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={page >= totalPages}
          onClick={() => onChange?.(page + 1)}
          aria-label={t('下一页')}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
