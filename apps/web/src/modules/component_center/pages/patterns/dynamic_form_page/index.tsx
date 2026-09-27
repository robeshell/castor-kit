/**
 * Page patterns → Dynamic form: the reference implementation of a form whose fields the user defines at runtime
 * (custom attributes, spec sheets, per-record settings), on the shared demo API (/api/admin/component-center/demo-records).
 *
 * Use it when a record has a fixed set of columns plus user-defined extra fields. Copy:
 * - the storage design (./form.ts): the dynamic fields are the record's jsonb `extra`, a plain `{ key: value }` object
 *   with native JSON values (text / number / boolean / 'YYYY-MM-DD'), so the data reads naturally everywhere: in SQL
 *   (`extra->>'客户'`), on the detail page, in the demo fixtures. The field type isn't stored; it is inferred from the
 *   value when the form opens (a text value shaped like a date reads back as a date).
 * - the form (./FieldRowsEditor.tsx): react-hook-form `useFieldArray` for the rows (add / remove), per-row validation
 *   (required and unique names, numeric values), a value control per type; the rows hold text and toFieldRows / toExtra
 *   convert at the API boundary. The rows are the whole `extra` object, so a removed row removes its key.
 * - the page: PageHeader → FilterBar → DataTable → FormDialog (fixed fields + FieldRowsEditor), buttons gated by the
 *   cc_patterns_* permissions.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { createItem, deleteItem, getItems, updateItem, type DemoRecord as Row } from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  STATUS_OPTIONS,
  statusOption,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import FieldRowsEditor from '@/modules/component_center/pages/patterns/dynamic_form_page/FieldRowsEditor'
import { toExtra, toFieldRows, type FormValues } from '@/modules/component_center/pages/patterns/dynamic_form_page/form'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'

const EMPTY_VALUES: FormValues = {
  name: '',
  code: '',
  category: null,
  status: 'todo',
  owner: '',
  is_active: true,
  description: '',
  fields: [],
}

const toFormValues = (record: Row): FormValues => ({
  name: record.name ?? '',
  code: record.code ?? '',
  category: record.category,
  status: record.status,
  owner: record.owner ?? '',
  is_active: Boolean(record.is_active),
  description: record.description ?? '',
  fields: toFieldRows(record.extra),
})

/** Keys shown in the list's field column before "+N" */
const KEYS_SHOWN = 3

export default function DynamicFormPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')
  const canEdit = hasPermission('cc_patterns_edit')
  const canDelete = hasPermission('cc_patterns_delete')

  const list = useCrudList(
    (params) =>
      getItems(params).catch((err: unknown) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const runSearch = () => list.handleSearch({ search: search.trim(), category, status })
  const reset = () => {
    setSearch('')
    setCategory('')
    setStatus('')
    list.handleReset()
  }

  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  // List rows carry `extra`, so the form opens without fetching the record again
  const openEdit = (record: Row) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  const submit = async ({ fields, ...values }: FormValues) => {
    const extra = toExtra(fields)
    try {
      if (editing) {
        await updateItem(editing.id, { ...values, extra })
        toast.success('更新成功')
      } else {
        await createItem({ ...values, extra })
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record: Row) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const columns: DataTableColumn<Row>[] = [
    { key: 'name', title: '名称', dataIndex: 'name', minWidth: 160, render: (value) => <span className="font-medium">{value}</span> },
    {
      key: 'code',
      title: '编码',
      dataIndex: 'code',
      width: 140,
      render: (value) => <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">{value}</code>,
    },
    {
      key: 'category',
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (value) => {
        const label = categoryLabel(value)
        return label ? t(label) : '-'
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const option = statusOption(value)
        return option ? (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        ) : (
          '-'
        )
      },
    },
    {
      key: 'fields',
      title: '动态字段',
      minWidth: 200,
      render: (_, record) => {
        const keys = Object.keys(record.extra)
        if (!keys.length) return <span className="text-muted-foreground">-</span>
        return (
          <div className="flex flex-wrap items-center gap-1">
            {keys.slice(0, KEYS_SHOWN).map((key) => (
              <span key={key} className="text-muted-foreground inline-flex h-5 items-center rounded-md border px-1.5 text-[11px]">
                {key}
              </span>
            ))}
            {keys.length > KEYS_SHOWN ? <span className="text-muted-foreground text-xs tabular-nums">+{keys.length - KEYS_SHOWN}</span> : null}
          </div>
        )
      },
    },
    { key: 'owner', title: '负责人', dataIndex: 'owner', width: 100 },
    {
      key: 'is_active',
      title: '是否启用',
      dataIndex: 'is_active',
      width: 90,
      render: (value) => {
        const option = enabledOption(Boolean(value))
        return (
          <StatusBadge tone={option.tone} dot>
            {option.label}
          </StatusBadge>
        )
      },
    },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 120,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          {canEdit ? (
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
              {t('编辑')}
            </Button>
          ) : null}
          {canDelete ? (
            <ConfirmAction title="确认删除该记录？" description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                {t('删除')}
              </Button>
            </ConfirmAction>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="动态表单"
        actions={
          canAdd ? (
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新增')}
            </Button>
          ) : null
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="名称 / 编码" />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} placeholder="分类" allLabel="全部分类" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="状态" allLabel="全部状态" />
      </FilterBar>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        minWidth={1000}
        emptyTitle="暂无数据"
        emptyDescription={filters.search || filters.category || filters.status ? '换个筛选条件试试' : undefined}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑记录' : '新增记录'}
        description={editing ? t('正在编辑 {{name}}', { name: editing.name }) : undefined}
        form={form}
        onSubmit={submit}
        size="lg"
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
          <FormInput control={form.control} name="code" label="编码" rules={{ required: '请输入编码' }} />
          <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '请选择状态' }} />
          <FormInput control={form.control} name="owner" label="负责人" />
          <FormSwitch control={form.control} name="is_active" label="是否启用" />
        </FormGrid>

        <Separator />
        <FieldRowsEditor form={form} />
        <Separator />

        <FormTextarea control={form.control} name="description" label="描述" rows={3} />
      </FormDialog>
    </div>
  )
}
