import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'
import EmptyState from '@/shared/components/EmptyState'

/**
 * 数据表格。列定义：
 *   columns = [
 *     { key: 'username', title: '用户名', dataIndex: 'username', width: 200 },
 *     { key: 'status', title: '状态', render: (value, row, index) => <StatusBadge …/> },
 *     { key: 'actions', title: '', align: 'right', width: 120, render: (_, row) => <RowActions …/> },
 *   ]
 *
 * props:
 *   data / columns / rowKey（默认 'id'）/ loading
 *   pagination = { page, perPage, total, onChange(page) }   // 不传则不显示分页
 *   selectable + selectedKeys + onSelectionChange(keys, rows)
 *   onRowClick(row) / rowClassName(row) / emptyTitle / emptyDescription / emptyAction
 *   bordered（默认 true：外层带卡片边框）/ dense（紧凑行高）
 */
/** 骨架条宽度：按行列错开，避免每行一模一样像条形码 */
const SKELETON_WIDTHS = ['w-2/3', 'w-1/2', 'w-3/4', 'w-2/5', 'w-3/5']
function skeletonWidth(row, col) {
  return SKELETON_WIDTHS[(row * 7 + col * 3) % SKELETON_WIDTHS.length]
}

export default function DataTable({
  data = [],
  columns = [],
  rowKey = 'id',
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
}) {
  const tx = useTx()
  const getKey = (row, index) => (typeof rowKey === 'function' ? rowKey(row, index) : row?.[rowKey] ?? index)
  const keySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const pageKeys = data.map(getKey)
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => keySet.has(k))
  const someSelected = !allSelected && pageKeys.some((k) => keySet.has(k))

  const toggleAll = (checked) => {
    if (!onSelectionChange) return
    if (checked) {
      const next = Array.from(new Set([...selectedKeys, ...pageKeys]))
      onSelectionChange(next, data.filter((row, i) => next.includes(getKey(row, i))))
    } else {
      const next = selectedKeys.filter((k) => !pageKeys.includes(k))
      onSelectionChange(next, [])
    }
  }
  const toggleOne = (row, index, checked) => {
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
              {columns.map((col) => (
                <th
                  key={col.key || col.dataIndex}
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
                    {columns.map((col, j) => (
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
                      {columns.map((col) => {
                        const value = col.dataIndex ? row?.[col.dataIndex] : undefined
                        const content = col.render ? col.render(value, row, index) : value
                        return (
                          <td
                            key={col.key || col.dataIndex}
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

function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…')
    result.push(p)
  })
  return result
}

/** 分页条：共 N 条 · 页码 · 上一页/下一页 */
export function DataPagination({ page = 1, perPage = 20, total = 0, onChange, loading = false, className }) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
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
                p === page ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:bg-accent',
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
