import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Download, Pin, Plus, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  createAnnouncement,
  deleteAnnouncement,
  downloadAnnouncementTemplate,
  exportAnnouncements,
  getAnnouncements,
  importAnnouncements,
  publishAnnouncement,
  unpublishAnnouncement,
  updateAnnouncement,
} from '@/modules/admin/api/announcement'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ExportDialog from '@/shared/components/data-transfer/ExportDialog'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'
import { useTranslation } from 'react-i18next'

const TYPE_OPTIONS = [
  { label: '系统公告', value: 'system' },
  { label: '活动公告', value: 'activity' },
  { label: '版本更新', value: 'update' },
]
const TYPE_TONE_MAP = { system: 'info', activity: 'warning', update: 'success' }
const TYPE_LABEL_MAP = { system: '系统公告', activity: '活动公告', update: '版本更新' }
const STATUS_FILTER_ITEMS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]
const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]
const EXPORT_FIELD_OPTIONS = [
  { label: 'ID', value: 'id' },
  { label: '标题', value: 'title' },
  { label: '公告类型', value: 'announce_type' },
  { label: '状态', value: 'status' },
  { label: '是否置顶', value: 'is_top' },
  { label: '排序权重', value: 'sort_order' },
  { label: '内容', value: 'content' },
  { label: '发布时间', value: 'publish_at' },
  { label: '创建时间', value: 'created_at' },
]
const DEFAULT_VALUES = { title: '', announce_type: 'system', content: '', status: 'draft', is_top: false, sort_order: 0 }

export default function Announcements() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getAnnouncements(params).catch(() => {
        toast.error('加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handleSearch, handlePageChange } = list
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const form = useForm({ defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.reset(DEFAULT_VALUES)
    setFormOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.reset({
      title: record.title ?? '',
      content: record.content ?? '',
      announce_type: record.announce_type ?? 'system',
      status: record.status ?? 'draft',
      is_top: Boolean(record.is_top),
      sort_order: record.sort_order ?? 0,
    })
    setFormOpen(true)
  }

  const remove = async (record) => {
    try {
      await deleteAnnouncement(record.id)
      toast.success('删除成功')
      fetchData()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const publish = async (record) => {
    try {
      await publishAnnouncement(record.id)
      toast.success('已发布')
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const unpublish = async (record) => {
    try {
      await unpublishAnnouncement(record.id)
      toast.success('已撤回为草稿')
      fetchData()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const submit = async (values) => {
    try {
      if (editing) await updateAnnouncement(editing.id, values)
      else await createAnnouncement(values)
      toast.success(editing ? '编辑成功' : '创建成功')
      setFormOpen(false)
      handleSearch()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const handleExport = async ({ fields, fileType }) => {
    try {
      const blob = await exportAnnouncements({ fields, file_type: fileType, export_mode: 'all' })
      downloadBlobFile(blob, `announcements_export.${fileType}`)
      setExportOpen(false)
      toast.success('导出成功')
    } catch {
      toast.error('导出失败')
    }
  }

  const handleDownloadTemplate = (fileType) => {
    downloadAnnouncementTemplate(fileType)
      .then((blob) => downloadBlobFile(blob, `announcements_template.${fileType}`))
      .catch(() => toast.error('模板下载失败'))
  }

  const columns = [
    {
      key: 'announce_type',
      title: '类型',
      dataIndex: 'announce_type',
      width: 100,
      render: (v) => <StatusBadge tone={TYPE_TONE_MAP[v] || 'info'}>{TYPE_LABEL_MAP[v] || v}</StatusBadge>,
    },
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      render: (v, record) => (
        <span className="flex min-w-0 items-center gap-2">
          {record.is_top ? (
            <StatusBadge tone="danger" className="shrink-0">
              <Pin className="size-3" />
              {t('置顶')}
            </StatusBadge>
          ) : null}
          <span className="truncate font-medium">{v}</span>
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (v) =>
        v === 'published' ? (
          <StatusBadge tone="success" dot>
            {t('已发布')}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot>
            {t('草稿')}
          </StatusBadge>
        ),
    },
    {
      key: 'publish_at',
      title: '发布时间',
      dataIndex: 'publish_at',
      width: 170,
      className: 'tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'created_at',
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v, ''),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 168,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          {record.status === 'draft' ? (
            <ConfirmAction title="确认发布该公告？" confirmText="发布" destructive={false} onConfirm={() => publish(record)}>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary h-7 px-2">
                {t('发布')}
              </Button>
            </ConfirmAction>
          ) : (
            <ConfirmAction title="确认撤回该公告？" confirmText="撤回" destructive={false} onConfirm={() => unpublish(record)}>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                {t('撤回')}
              </Button>
            </ConfirmAction>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该公告？" description="删除后不可恢复" confirmText="删除" onConfirm={() => remove(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const statusFilter = filters.status ?? ''

  return (
    <div>
      <PageHeader
        title="公告管理"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload />
              {t('导入')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download />
              {t('导出')}
            </Button>
            <Button size="sm" variant="brand" onClick={openCreate}>
              <Plus />
              {t('新增公告')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <SegmentedTabs variant="pill" value={statusFilter} onChange={(val) => handleSearch({ status: val })} items={STATUS_FILTER_ITEMS} />
        <Button variant="ghost" size="sm" className="text-muted-foreground h-8" onClick={() => fetchData()}>
          <RefreshCw className={cn(loading && 'animate-spin')} />
          {t('刷新')}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={860}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle="暂无公告"
        emptyDescription={statusFilter ? '换个状态筛选试试' : '点击右上角「新增公告」发布第一条'}
      />

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑公告' : '新增公告'}
        description={editing ? t('正在编辑「{{title}}」', { title: editing.title }) : '保存为草稿后可在列表中发布'}
        form={form}
        onSubmit={submit}
      >
        <FormInput control={form.control} name="title" label="标题" placeholder="请输入公告标题" rules={{ required: '请输入公告标题' }} />
        <FormGrid>
          <FormSelect control={form.control} name="announce_type" label="公告类型" options={TYPE_OPTIONS} />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
        </FormGrid>
        <FormTextarea control={form.control} name="content" label="内容" placeholder="请输入公告内容（可选）" rows={6} inputClassName="min-h-32" />
        <FormGrid>
          <FormNumber control={form.control} name="sort_order" label="排序权重" placeholder="数字越小越靠前" />
          <FormSwitch control={form.control} name="is_top" label="是否置顶" className="self-end" />
        </FormGrid>
      </FormDialog>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} title="导出公告" fieldOptions={EXPORT_FIELD_OPTIONS} onConfirm={handleExport} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入公告"
        targetLabel="公告列表"
        onDownloadTemplate={handleDownloadTemplate}
        onImport={(file) => importAnnouncements(file)}
        onImported={() => handleSearch()}
        errorExportFileName="announcements_import_errors.csv"
      />
    </div>
  )
}
