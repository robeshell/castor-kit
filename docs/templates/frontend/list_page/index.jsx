/**
 * 标准列表页模板（shadcn/ui 体系，含导入导出）
 *
 * 替换说明：
 *   - <Resource> → PascalCase 资源名（如 CustomerOrder）；<resource> → snake_case（如 customer_order）
 *   - <module> → admin 或 component_center（与页面所在模块一致）
 *   - 补充实际字段：EXPORT_FIELDS（与后端 EXPORT_FIELD_MAP 的 key 对应）、EMPTY_VALUES / toFormValues、columns、表单字段
 *   - 字段类型 → 表单组件：str→FormInput、text→FormTextarea、int/float→FormNumber、bool→FormSwitch、
 *     date→FormDate、datetime→FormDateTime；枚举→FormSelect（options [{label,value}]）
 *   - 表格列：bool/状态 → StatusBadge；日期 → formatDate / formatDateTime；数字加 tabular-nums
 *
 * 参考实现：apps/web/src/modules/admin/pages/users/index.jsx；`pnpm scaffold` 生成的页面就是本模板的实例。
 * 方案与约定：docs/frontend-redesign-plan.md
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Download, Plus, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  createItem,
  deleteItem,
  downloadTemplate,
  exportItems,
  getItems,
  importItems,
  updateItem,
} from '@/modules/<module>/api/<resource>'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormSelect, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'

// 按实际字段调整（与后端 EXPORT_FIELD_MAP key 对应）
const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '状态', value: 'status' },
  { label: '创建时间', value: 'created_at' },
]

// 枚举：筛选与表单共用；tone 决定 StatusBadge 颜色
const STATUS_OPTIONS = [
  { label: '启用', value: 'active', tone: 'success' },
  { label: '停用', value: 'inactive', tone: 'neutral' },
]
const STATUS_MAP = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o]))

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const EMPTY_VALUES = { name: '', status: 'active', remark: '' }

/** 编辑：只取表单字段（id / created_at 不回传）；日期用 formatDate(v, '') / formatDateTime(v, '') 转成选择器格式 */
const toFormValues = (record) => ({
  name: record.name ?? '',
  status: record.status ?? 'active',
  remark: record.remark ?? '',
})

export default function <Resource>Page() {
  const list = useCrudList(
    (params) =>
      getItems(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selectedKeys, setSelectedKeys] = useState([])
  const [editing, setEditing] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: EMPTY_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时拉一次
  }, [])

  // ── 新增 / 编辑 ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset(toFormValues(record))
    setFormOpen(true)
  }

  // 抛错时 FormDialog 保持打开；后端 {error} 文案由 toast.apiError 展示
  const submit = async (values) => {
    try {
      if (editing) {
        await updateItem(editing.id, values)
        toast.success('更新成功')
      } else {
        await createItem(values)
        toast.success('创建成功')
      }
      setFormOpen(false)
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  // ── 删除 ────────────────────────────────────────────────────────────────────
  const remove = async (record) => {
    try {
      await deleteItem(record.id)
      toast.success('删除成功')
      setSelectedKeys((keys) => keys.filter((k) => k !== record.id))
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  // ── 筛选 ────────────────────────────────────────────────────────────────────
  const runSearch = () => {
    setSelectedKeys([])
    list.handleSearch({ search: search.trim(), status })
  }
  const reset = () => {
    setSearch('')
    setStatus('')
    setSelectedKeys([])
    list.handleReset()
  }

  // ── 导出：勾选优先（ids）；后端支持按筛选导出时在这里加 payload.filters = filters ─────
  const handleExport = async ({ fields, fileType }) => {
    const type = normalizeFileType(fileType)
    const payload = { fields, file_type: type }
    if (selectedKeys.length) payload.ids = selectedKeys
    try {
      const blob = await exportItems(payload)
      downloadBlobFile(blob, `<resource>_export.${type}`)
      toast.success('导出成功')
      setExportOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  // ── 表格列 ──────────────────────────────────────────────────────────────────
  const columns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 72, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '名称', dataIndex: 'name', render: (value) => <span className="font-medium">{value}</span> },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => (
        <StatusBadge tone={STATUS_MAP[value]?.tone ?? 'neutral'} dot>
          {STATUS_MAP[value]?.label ?? value ?? '-'}
        </StatusBadge>
      ),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      className: 'text-muted-foreground tabular-nums',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 132,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <ConfirmAction title={`删除「${record.name}」？`} description="删除后不可恢复。" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              删除
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* 页头：每页最多一个 variant="brand" 主操作，其余 outline / ghost */}
      <PageHeader
        title="<页面标题>"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              导出
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              新增
            </Button>
          </>
        }
      />

      {/* 筛选栏 */}
      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索名称" />
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="全部状态" />
      </FilterBar>

      {/* 勾选提示条 */}
      <AnimatePresence>
        {selectedKeys.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-soft mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
              <span>
                已勾选 <span className="font-medium tabular-nums">{selectedKeys.length}</span> 条，导出时将优先导出勾选数据
              </span>
              <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setSelectedKeys([])}>
                <X />
                清空勾选
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 表格：loading 骨架、空态、分页由 DataTable 提供 */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        selectable
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无数据"
        emptyDescription={filters.search || filters.status ? '换个筛选条件试试' : '点击右上角「新增」添加第一条数据'}
      />

      {/* 新增 / 编辑（react-hook-form）；rules 的 message 照后端/产品文案写 */}
      <FormDialog open={formOpen} onOpenChange={setFormOpen} title={editing ? '编辑' : '新增'} form={form} onSubmit={submit}>
        <FormInput control={form.control} name="name" label="名称" placeholder="请输入名称" rules={{ required: '请输入名称' }} />
        <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
        <FormTextarea control={form.control} name="remark" label="备注" placeholder="选填" />
      </FormDialog>

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="导出<资源名>"
        ruleHint={selectedKeys.length ? `已勾选 ${selectedKeys.length} 条，将只导出勾选数据。` : '未勾选数据时导出全部数据。'}
        fieldOptions={EXPORT_FIELDS}
        onConfirm={handleExport}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入<资源名>"
        targetLabel="<资源名>"
        onDownloadTemplate={(fileType) =>
          downloadTemplate(normalizeFileType(fileType))
            .then((blob) => {
              downloadBlobFile(blob, `<resource>_import_template.${normalizeFileType(fileType)}`)
              toast.success('模板已下载')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }
        onImport={(file) => importItems(file)}
        onImported={(res) => {
          toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="<resource>_import_error_rows.csv"
      />
    </div>
  )
}
