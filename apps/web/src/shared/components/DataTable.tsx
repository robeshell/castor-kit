import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'

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
 *   onRowClick(row) / rowClassName(row) / emptyTitle / emptyDescription / emptyAction
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
  /** Single line with an ellipsis (a string cell gets the full text as its title) */
  ellipsis?: boolean
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
  onRowClick?: (row: NoInfer<Row>, index: number) => void
  rowClassName?: (row: NoInfer<Row>, index: number) => string | undefined
  /** Chinese source text (translated here) or a node */
  emptyTitle?: ReactNode
  emptyDescription?: ReactNode
  emptyAction?: ReactNode
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

export default function DataTable<Row extends object = Record<string, unknown>, TKey extends RowKey = RowKey>({
  data = [],
  columns = [],
  rowKey = 'id' as keyof Row & string,
  loading = false,
  pagination,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  onRowClick,
  rowClassName,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyAction,
  bordered = true,
  dense = false,
  className,
  minWidth,
}: DataTableProps<Row, TKey>) {
  const tx = useTx()
  // A field key yields whatever the row holds there; the page picks rowKey / selectedKeys to match
  const getKey = (row: Row, index: number): TKey => (typeof rowKey === 'function' ? rowKey(row, index) : ((row?.[rowKey] ?? index) as TKey))
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

  const rowHeight = dense ? 'h-10' : 'h-12'
  const skeletonRows = Math.min(Math.max(pagination?.perPage || 8, 5), 10)

  return (
    <div className={cn(bordered && 'surface-card', 'overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-[13px]" style={minWidth ? { minWidth } : undefined}>
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
                    col.headerClassName,
                  )}
                >
                  {tx(col.title)}
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
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                      data-state={selected ? 'selected' : undefined}
                      style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
                      className={cn(
                        'group/row animate-in fade-in-0 slide-in-from-bottom-0.5 fill-mode-both border-b transition-colors duration-150 last:border-0',
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
                        const value = col.dataIndex ? row?.[col.dataIndex] : undefined
                        // Without render the raw value is shown: the column's field has to hold something renderable
                        const content = col.render ? col.render(value, row, index) : (value as ReactNode)
                        return (
                          <td
                            key={col.key || col.dataIndex || j}
                            className={cn(
                              'px-3 py-2 align-middle',
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              col.ellipsis && 'max-w-0 truncate',
                              col.className,
                            )}
                            title={col.ellipsis && typeof content === 'string' ? content : undefined}
                          >
                            {content === null || content === undefined || content === '' ? (
                              <span className="text-muted-foreground/60">-</span>
                            ) : (
                              content
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
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
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
    if (i > 0 && p - sorted[i - 1]! > 1) result.push('…')
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
      <span className="text-muted-foreground tabular-nums">
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
