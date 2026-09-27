import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ImportDialog, { type ImportFailure, type ImportResult } from '@/shared/components/data-transfer/ImportDialog'

// What the API answers when rows fail (400): nothing was imported, the whole batch was rolled back.
// error_rows holds up to 500 rows as { line, reason, row }; row is the source row keyed by the file's (Chinese) headers,
// and reason comes already translated into the user's language
const FAILURE: ImportFailure = {
  error: '导入失败，存在错误数据',
  error_rows: [
    { line: 3, reason: 'Email is not a valid address', row: { 名称: 'Contoso Ltd.', 邮箱: 'buyer@contoso', 城市: 'Toronto' } },
    { line: 5, reason: 'Name is required', row: { 名称: '', 邮箱: 'hello@fabrikam.test', 城市: 'Berlin' } },
    { line: 9, reason: 'Name already exists in the file (line 2)', row: { 名称: 'Northwind Traders', 邮箱: 'ap@northwind.test', 城市: 'Seattle' } },
  ],
  error_count: 3,
}

// Stand-in for the import call: request.ts rejects with the API's error body, so reject with the same shape
const importCustomers = (_file: File): Promise<ImportResult> =>
  new Promise((_, reject) => setTimeout(() => reject(FAILURE), 1500))

export default function ImportErrorRows() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload />
        {t('导入客户（有错误行）')}
      </Button>
      {/* Nothing to handle in the page: the dialog shows the error toast, the failed row count and a download of the details */}
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        title="导入客户"
        targetLabel="客户"
        onImport={(file) => importCustomers(file)}
        errorExportFileName="customers_import_errors.csv"
      />
    </>
  )
}
