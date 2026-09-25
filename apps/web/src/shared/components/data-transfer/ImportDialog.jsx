import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { downloadErrorRowsCsv } from '@/shared/utils/file'

const DEFAULT_FORMATS = ['csv', 'xlsx']
const DEFAULT_TEMPLATE_OPTIONS = [
  { label: 'XLSX (.xlsx)', value: 'xlsx' },
  { label: 'CSV (.csv)', value: 'csv' },
]

/**
 * Import dialog (replaces ImportCsvModal, same props, visible → open):
 *   <ImportDialog open={open} onOpenChange={setOpen} title="导入用户"
 *     onDownloadTemplate={(fileType) => …} onImport={(file) => api(file)} onImported={() => reload()} />
 * If onImport returns { created, updated }, the result is shown; if it throws { error, error_rows }, the failure details are shown and can be downloaded.
 */
export default function ImportDialog({
  open,
  onOpenChange,
  title = '导入数据',
  targetLabel,
  onDownloadTemplate,
  onImport,
  onImported,
  errorExportFileName = 'import_error_rows.csv',
  supportedFormats = DEFAULT_FORMATS,
  templateFormatOptions = DEFAULT_TEMPLATE_OPTIONS,
  defaultTemplateFormat = 'xlsx',
}) {
  // State lives in ImportBody: Radix unmounts DialogContent on close, so reopening starts fresh
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange?.(next)}>
      <DialogContent className="sm:max-w-[560px]">
        <ImportBody
          title={title}
          targetLabel={targetLabel}
          onDownloadTemplate={onDownloadTemplate}
          onImport={onImport}
          onImported={onImported}
          errorExportFileName={errorExportFileName}
          supportedFormats={supportedFormats}
          templateFormatOptions={templateFormatOptions}
          defaultTemplateFormat={defaultTemplateFormat}
          onBusyChange={setBusy}
          onClose={() => onOpenChange?.(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({
  title,
  targetLabel,
  onDownloadTemplate,
  onImport,
  onImported,
  errorExportFileName,
  supportedFormats,
  templateFormatOptions,
  defaultTemplateFormat,
  onBusyChange,
  onClose,
}) {
  const { t } = useTranslation()
  const tx = useTx()
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [errorRows, setErrorRows] = useState([])
  const [templateType, setTemplateType] = useState(
    () => templateFormatOptions.find((o) => o.value === defaultTemplateFormat)?.value || templateFormatOptions[0]?.value || 'xlsx',
  )

  const formats = supportedFormats.map((f) => String(f).toLowerCase())
  const accept = formats.map((f) => `.${f}`).join(',')
  const hint = formats.map((f) => f.toUpperCase()).join(' / ')

  useEffect(() => () => clearInterval(timerRef.current), [])

  const pick = (raw) => {
    if (!raw) return
    const ext = (raw.name || '').toLowerCase().split('.').pop()
    if (!formats.includes(ext)) {
      toast.error(t('仅支持 {{formats}} 文件', { formats: hint }))
      return
    }
    setFile(raw)
    setResult(null)
    setErrorRows([])
    setProgress(0)
  }

  const run = () => {
    if (!file) {
      toast.warning('请先选择导入文件')
      return
    }
    setImporting(true)
    setResult(null)
    setErrorRows([])
    setProgress(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : Math.min(92, p + Math.max(1, Math.round((92 - p) * 0.2)))))
    }, 120)
    Promise.resolve(onImport?.(file))
      .then((res) => {
        clearInterval(timerRef.current)
        setProgress(100)
        setResult(res || {})
        onImported?.(res || {})
      })
      .catch((err) => {
        clearInterval(timerRef.current)
        setProgress(0)
        setErrorRows(Array.isArray(err?.error_rows) ? err.error_rows : [])
        toast.apiError(err, '导入失败')
      })
      .finally(() => setImporting(false))
  }

  useEffect(() => {
    onBusyChange?.(importing)
  }, [importing, onBusyChange])

  return (
    <>
        <DialogHeader>
          <DialogTitle>{tx(title)}</DialogTitle>
          <DialogDescription>
            {targetLabel ? t('导入到：{{target}}。', { target: tx(targetLabel) }) : null}
            {t('支持 {{formats}}，单个文件不超过 5MB。', { formats: hint })}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
          <span className="text-muted-foreground text-xs">{t('先下载模板，按表头填写后上传')}</span>
          <div className="flex items-center gap-2">
            <Select value={templateType} onValueChange={setTemplateType} disabled={importing}>
              <SelectTrigger size="sm" className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateFormatOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" disabled={importing || !onDownloadTemplate} onClick={() => onDownloadTemplate?.(templateType)}>
              <Download />
              {t('下载模板')}
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            pick(e.dataTransfer?.files?.[0])
          }}
          className={cn(
            'group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-all duration-200',
            dragging ? 'border-primary bg-brand-soft scale-[1.01]' : 'hover:border-primary/60 hover:bg-muted/40',
          )}
        >
          <span className="bg-brand-soft text-primary flex size-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:-translate-y-0.5">
            <UploadCloud className="size-5" />
          </span>
          <span className="text-sm font-medium">{t('拖拽文件到这里，或点击选择')}</span>
          <span className="text-muted-foreground text-xs">{hint}</span>
        </button>

        <AnimatePresence initial={false}>
          {file ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                <FileSpreadsheet className="text-success size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{file.name}</div>
                  <div className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(1)} KB</div>
                </div>
                {!importing ? (
                  <Button variant="ghost" size="icon" className="size-7" aria-label={t('移除文件')} onClick={() => setFile(null)}>
                    <X />
                  </Button>
                ) : null}
              </div>
              {importing || progress > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <div className="text-muted-foreground text-xs">{importing ? t('正在导入…') : progress >= 100 ? t('导入完成') : ''}</div>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {result ? (
          <div className="bg-success-soft text-success flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]">
            <CircleCheck className="size-4" />
            {t('导入完成：新增 {{created}} 条，更新 {{updated}} 条', { created: result.created || 0, updated: result.updated || 0 })}
          </div>
        ) : null}
        {!result && errorRows.length > 0 ? (
          <div className="bg-danger-soft flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px]">
            <span className="text-danger flex items-center gap-2">
              <TriangleAlert className="size-4" />
              {t('共 {{count}} 行数据有误，未导入任何数据', { count: errorRows.length })}
            </span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => downloadErrorRowsCsv(errorRows, errorExportFileName)}>
              {t('下载失败明细')}
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={onClose}>
            {t('关闭')}
          </Button>
          <Button disabled={!file || importing} onClick={run}>
            {importing ? <Spinner /> : null}
            {t('开始导入')}
          </Button>
        </DialogFooter>
    </>
  )
}
