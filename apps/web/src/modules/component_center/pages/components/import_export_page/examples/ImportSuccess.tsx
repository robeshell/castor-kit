import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import ImportDialog, { type ImportResult } from '@/shared/components/data-transfer/ImportDialog'
import { downloadBlobFile } from '@/shared/utils/file'

// Stand-ins for the API file (a real page calls `POST /api/admin/<module>/import` and the template endpoint)
const importCustomers = (_file: File): Promise<ImportResult> =>
  new Promise((resolve) => setTimeout(() => resolve({ message: '导入成功', created: 12, updated: 3 }), 1500))

const downloadTemplate = (): Promise<Blob> => {
  // Headers stay Chinese in import / export files, so a file imports the same in every UI language
  // i18n-ignore-next-line: file headers, not UI copy
  const csv = '﻿名称,邮箱,城市\r\nNorthwind Traders,orders@northwind.test,Seattle\r\n'
  return Promise.resolve(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
}

export default function ImportSuccess() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload />
        {t('导入客户')}
      </Button>
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        title="导入客户"
        targetLabel="客户"
        // This mock only makes CSV templates, so offer just that format (the default offers XLSX and CSV)
        templateFormatOptions={[{ label: 'CSV (.csv)', value: 'csv' }]}
        defaultTemplateFormat="csv"
        onDownloadTemplate={(fileType) =>
          downloadTemplate()
            .then((blob) => {
              downloadBlobFile(blob, `customers_import_template.${fileType}`)
              toast.success('模板已下载')
            })
            .catch((err: unknown) => toast.apiError(err, '模板下载失败'))
        }
        // Resolve with { created, updated }: the dialog shows the counts and a full progress bar
        onImport={(file) => importCustomers(file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res.created || 0, updated: res.updated || 0 }))
          // A real page reloads its list here
        }}
      />
    </>
  )
}
