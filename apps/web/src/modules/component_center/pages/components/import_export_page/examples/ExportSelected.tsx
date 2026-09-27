import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/lib/toast'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'
import ExportDialog, { type ExportFieldOption, type ExportParams } from '@/shared/components/data-transfer/ExportDialog'

interface Customer {
  id: number
  name: string
  email: string
  city: string
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Northwind Traders', email: 'orders@northwind.test', city: 'Seattle' },
  { id: 2, name: 'Contoso Ltd.', email: 'buyer@contoso.test', city: 'Toronto' },
  { id: 3, name: 'Fabrikam Inc.', email: 'hello@fabrikam.test', city: 'Berlin' },
  { id: 4, name: 'Tailspin Toys', email: 'shop@tailspin.test', city: 'Osaka' },
]

// label is the Chinese source text (translated by the dialog), value the field name the API expects
const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '邮箱', value: 'email' },
  { label: '城市', value: 'city' },
  { label: '创建时间', value: 'created_at' },
] as const satisfies readonly ExportFieldOption[]

type ExportField = (typeof EXPORT_FIELDS)[number]['value']
type FileType = 'xlsx' | 'csv'

/** The export request body */
interface ExportBody {
  fields: ExportField[]
  file_type: FileType
  /** Only the selected rows; without it the API exports everything the current query matches */
  ids?: number[]
}

const isExportField = (value: string): value is ExportField => EXPORT_FIELDS.some((o) => o.value === value)
// The dialog hands back a plain string: narrow it to what the API accepts
const normalizeFileType = (raw: string): FileType => (raw === 'csv' ? 'csv' : 'xlsx')

/** What request.ts rejects with when the API answers with an error: the response body */
interface ApiErrorBody {
  error: string
}

// Stand-in for the export call (a real one resolves to the file Blob, saved with downloadBlobFile)
const exportCustomers = (body: ExportBody, fail: boolean): Promise<ExportBody> =>
  new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject({ error: '导出失败，请稍后重试' } satisfies ApiErrorBody) : resolve(body)), 1200),
  )

const columns: DataTableColumn<Customer>[] = [
  { key: 'name', title: '名称', dataIndex: 'name' },
  { key: 'email', title: '邮箱', dataIndex: 'email' },
  { key: 'city', title: '城市', dataIndex: 'city', width: 110 },
]

export default function ExportSelected() {
  const { t } = useTranslation()
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const [fail, setFail] = useState(false)
  const [lastBody, setLastBody] = useState<ExportBody | null>(null)

  // ExportDialog doesn't catch: handle the failure here and close the dialog only on success
  const handleExport = async ({ fields, fileType }: ExportParams) => {
    const body: ExportBody = { fields: fields.filter(isExportField), file_type: normalizeFileType(fileType) }
    if (selectedKeys.length) body.ids = selectedKeys
    try {
      setLastBody(await exportCustomers(body, fail))
      toast.success('导出成功')
      setOpen(false)
    } catch (err) {
      toast.apiError(err, '导出失败')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Download />
          {selectedKeys.length ? t('导出选中（{{count}}）', { count: selectedKeys.length }) : t('导出全部')}
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="export-fail" checked={fail} onCheckedChange={setFail} />
          <Label htmlFor="export-fail" className="text-[13px] font-normal">
            {t('模拟导出失败')}
          </Label>
        </div>
      </div>
      <DataTable columns={columns} data={CUSTOMERS} selectable selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} dense />
      {lastBody ? (
        <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(lastBody, null, 2)}</pre>
      ) : null}
      <ExportDialog
        open={open}
        onOpenChange={setOpen}
        title="导出客户"
        // Say what will be exported: the selected rows, or everything
        ruleHint={selectedKeys.length ? t('已勾选 {{count}} 条，将优先导出勾选数据。', { count: selectedKeys.length }) : '未勾选数据时导出全部数据。'}
        fieldOptions={EXPORT_FIELDS}
        // Fields checked when the dialog opens (default: all of them)
        defaultFields={['name', 'email', 'city']}
        onConfirm={handleExport}
      />
    </div>
  )
}
