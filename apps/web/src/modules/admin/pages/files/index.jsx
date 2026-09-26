import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Eye, FileArchive, FileSpreadsheet, FileText, File as FileIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes, formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { deleteFile, getFiles, uploadFile } from '@/modules/admin/api/files'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FilterBar, FilterSelect, SearchInput } from '@/shared/components/Filters'
import PageHeader from '@/shared/components/PageHeader'
import StatusBadge from '@/shared/components/StatusBadge'
import FileUpload from '@/shared/components/upload/FileUpload'
import { useCrudList } from '@/shared/hooks/useCrudList'

const KIND_OPTIONS = [
  { label: '图片', value: 'image' },
  { label: '文档', value: 'document' },
  { label: '其他', value: 'other' },
]
const REF_OPTIONS = [
  { label: '使用中', value: 'yes' },
  { label: '未使用', value: 'no' },
]

function FileThumb({ file }) {
  if (file.mime_type.startsWith('image/')) {
    return <img src={file.url} alt="" loading="lazy" className="bg-muted ring-border size-9 shrink-0 rounded-md object-cover ring-1" />
  }
  const Icon = file.mime_type.includes('sheet') || file.mime_type.includes('excel') || file.mime_type === 'text/csv'
    ? FileSpreadsheet
    : file.mime_type.includes('zip')
      ? FileArchive
      : file.mime_type.startsWith('text/') || file.mime_type.includes('pdf') || file.mime_type.includes('word')
        ? FileText
        : FileIcon
  return (
    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
      <Icon className="size-4" />
    </span>
  )
}

/**
 * File management: everything uploaded through the file center. Files still used by a record can't be deleted;
 * unused files are removed automatically 24 hours after upload.
 */
export default function Files() {
  const { t } = useTranslation()
  const list = useCrudList(
    (params) =>
      getFiles(params).catch((err) => {
        toast.apiError(err, '加载失败')
        return { items: [], total: 0 }
      }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, perPage, filters, fetchData, handlePageChange } = list
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [referenced, setReferenced] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploads, setUploads] = useState([])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runSearch = () => list.handleSearch({ search: search.trim(), kind, referenced })
  const reset = () => {
    setSearch('')
    setKind('')
    setReferenced('')
    list.handleReset()
  }

  const remove = async (file) => {
    try {
      await deleteFile(file.id)
      toast.success('文件已删除')
      fetchData(page)
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const closeUpload = (open) => {
    setUploadOpen(open)
    if (!open) {
      if (uploads.some((f) => f.status === 'success')) fetchData(1)
      setUploads([])
    }
  }

  const columns = [
    {
      key: 'original_name',
      title: '文件',
      dataIndex: 'original_name',
      minWidth: 240,
      render: (value, record) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <FileThumb file={record} />
          <div className="grid min-w-0 leading-tight">
            <span className="truncate font-medium" title={value}>
              {value}
            </span>
            <span className="text-muted-foreground truncate text-xs">{record.mime_type}</span>
          </div>
        </div>
      ),
    },
    { key: 'size', title: '大小', dataIndex: 'size', width: 96, align: 'right', className: 'tabular-nums', render: (v) => formatBytes(v) },
    { key: 'uploader_name', title: '上传人', dataIndex: 'uploader_name', width: 130 },
    {
      key: 'ref_count',
      title: '引用',
      dataIndex: 'ref_count',
      width: 110,
      render: (v) =>
        v > 0 ? (
          <StatusBadge tone="success" dot>
            {t('使用中 · {{count}}', { count: v })}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot>
            {t('未使用')}
          </StatusBadge>
        ),
    },
    {
      key: 'created_at',
      title: '上传时间',
      dataIndex: 'created_at',
      width: 170,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v, ''),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 190,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={record.url} target="_blank" rel="noreferrer">
              <Eye />
              {t('查看')}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={`${record.url}?download=1`}>
              <Download />
              {t('下载')}
            </a>
          </Button>
          {record.ref_count > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" disabled>
                    {t('删除')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t('文件正在被使用，不能删除')}</TooltipContent>
            </Tooltip>
          ) : (
            <ConfirmAction
              title={t('删除文件 {{name}}？', { name: record.original_name })}
              description="删除后不可恢复。"
              confirmText="删除"
              onConfirm={() => remove(record)}
            >
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                {t('删除')}
              </Button>
            </ConfirmAction>
          )}
        </div>
      ),
    },
  ]

  const filtered = Boolean(filters.search || filters.kind || filters.referenced)

  return (
    <div>
      <PageHeader
        title="文件管理"
        actions={
          <Button size="sm" variant="brand" onClick={() => setUploadOpen(true)}>
            <Upload />
            {t('上传文件')}
          </Button>
        }
      />

      <FilterBar onSearch={runSearch} onReset={reset}>
        <SearchInput value={search} onChange={setSearch} onSubmit={runSearch} placeholder="搜索文件名" />
        <FilterSelect value={kind} onChange={setKind} options={KIND_OPTIONS} placeholder="类型" />
        <FilterSelect value={referenced} onChange={setReferenced} options={REF_OPTIONS} placeholder="使用情况" />
      </FilterBar>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        minWidth={940}
        pagination={{ page, perPage, total, onChange: handlePageChange }}
        emptyTitle={filtered ? '没有找到文件' : '还没有文件'}
        emptyDescription={filtered ? '换个关键词试试' : '上传的头像和附件会出现在这里'}
      />

      <Dialog open={uploadOpen} onOpenChange={closeUpload}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('上传文件')}</DialogTitle>
            <DialogDescription>{t('未被任何记录使用的文件会在上传 24 小时后自动清理。')}</DialogDescription>
          </DialogHeader>
          <FileUpload fileList={uploads} onFileListChange={setUploads} uploadApi={uploadFile} accept="" maxSizeMB={100} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
