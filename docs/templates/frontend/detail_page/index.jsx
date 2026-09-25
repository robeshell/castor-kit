/**
 * Detail page template (shadcn/ui: list on the left + details on the right, stacked vertically on mobile)
 *
 * Replacements:
 *   - <Resource> → PascalCase resource name; <resource> → snake_case; <module> → admin or component_center
 *   - Fill in actual fields: SideItem content, DescriptionList items, EMPTY_VALUES / toFormValues, form fields
 *   - Add or remove tabs as needed (SegmentedTabs items)
 *
 * Reference implementation: apps/web/src/modules/component_center/pages/admin/detail_tabs_page/index.jsx
 * Design and conventions: docs/frontend-redesign-plan.md
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'motion/react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { stagger } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createItem, deleteItem, getItems, updateItem } from '@/modules/<module>/api/<resource>'
import ConfirmAction from '@/shared/components/ConfirmAction'
import EmptyState from '@/shared/components/EmptyState'
import { DescriptionList, FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'

const TABS = [
  { value: 'info', label: '基本信息' },
  { value: 'activity', label: '动态' },
]

const EMPTY_VALUES = { name: '', remark: '' }
const toFormValues = (record) => ({ name: record.name ?? '', remark: record.remark ?? '' })

// ─── Left list item ─────────────────────────────────────────────────────────
function SideItem({ item, selected, onClick }) {
  return (
    <motion.button
      type="button"
      variants={stagger.item}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-start gap-1 border-b px-4 py-3 text-left transition-colors last:border-b-0',
        selected ? 'bg-brand-soft' : 'hover:bg-muted/60',
      )}
    >
      {/* Replace with the actual display content */}
      <span className={cn('truncate text-sm', selected && 'text-primary font-medium')}>{item.name}</span>
      <StatusBadge tone={item.status === 'active' ? 'success' : 'neutral'} variant="plain" dot>
        {item.status ?? '-'}
      </StatusBadge>
    </motion.button>
  )
}

export default function <Resource>Page() {
  const [list, setList] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true) // Only means the first load; on refresh keep the old list and don't flash the skeleton
  const [tab, setTab] = useState('info')
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)

  const form = useForm({ defaultValues: EMPTY_VALUES })

  // Use a promise chain and only setState inside callbacks (react-hooks/set-state-in-effect forbids synchronous setState in an effect)
  const fetchList = (keepId) =>
    getItems({ page: 1, per_page: 100 })
      .then((res) => {
        const items = res.items || [] // request.js already unwraps the response; don't write res.data.items
        setList(items)
        setSelected((prev) => items.find((i) => i.id === (keepId ?? prev?.id)) ?? items[0] ?? null)
      })
      .catch((err) => toast.apiError(err, '加载失败'))
      .finally(() => setLoading(false))

  useEffect(() => {
    fetchList()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  const openEdit = () => {
    setEditing(selected)
    form.reset(toFormValues(selected))
    setFormOpen(true)
  }

  const submit = async (values) => {
    try {
      if (editing) {
        await updateItem(editing.id, values)
        toast.success('更新成功')
        setFormOpen(false)
        fetchList(editing.id)
      } else {
        const created = await createItem(values)
        toast.success('创建成功')
        setFormOpen(false)
        fetchList(created?.id)
      }
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async () => {
    try {
      await deleteItem(selected.id)
      toast.success('删除成功')
      setSelected(null)
      fetchList()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  return (
    <div>
      <PageHeader
        title="<页面标题>"
        actions={
          <Button size="sm" variant="brand" onClick={openCreate}>
            <Plus />
            新增
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left list */}
        <Panel padded={false} className="md:max-h-[calc(100vh-180px)] md:overflow-y-auto">
          {loading && list.length === 0 ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState title="暂无数据" description="点击右上角「新增」添加第一条数据" />
          ) : (
            <motion.div variants={stagger.container} initial="hidden" animate="show">
              {list.map((item) => (
                <SideItem key={item.id} item={item} selected={selected?.id === item.id} onClick={() => setSelected(item)} />
              ))}
            </motion.div>
          )}
        </Panel>

        {/* Right details */}
        <Panel className="min-w-0">
          {!selected ? (
            <EmptyState title="请从左侧选择" />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Replace with the actual avatar / icon */}
                  <span className="bg-brand-gradient-strong flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white">
                    {(selected.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{selected.name}</h2>
                    <p className="text-muted-foreground text-xs tabular-nums">创建于 {formatDateTime(selected.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openEdit}>
                    <Pencil />
                    编辑
                  </Button>
                  <ConfirmAction title={`删除「${selected.name}」？`} description="删除后不可恢复。" confirmText="删除" onConfirm={remove}>
                    <Button variant="outline" size="sm" className="text-danger hover:text-danger">
                      <Trash2 />
                      删除
                    </Button>
                  </ConfirmAction>
                </div>
              </div>

              <SegmentedTabs value={tab} onChange={setTab} items={TABS} />

              {tab === 'info' ? (
                // Replace with the actual fields
                <DescriptionList
                  columns={2}
                  items={[
                    { label: '名称', value: selected.name },
                    { label: '状态', value: selected.status },
                    { label: '创建时间', value: formatDateTime(selected.created_at) },
                    { label: '更新时间', value: formatDateTime(selected.updated_at) },
                    { label: '备注', value: selected.remark, full: true },
                  ]}
                />
              ) : (
                <EmptyState title="暂无动态" />
              )}
            </div>
          )}
        </Panel>
      </div>

      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑' : '新增'} form={form} onSubmit={submit}>
        {/* Add the actual form fields */}
        <FormInput control={form.control} name="name" label="名称" placeholder="请输入名称" rules={{ required: '请输入名称' }} />
        <FormTextarea control={form.control} name="remark" label="备注" placeholder="选填" />
      </FormDialog>
    </div>
  )
}
