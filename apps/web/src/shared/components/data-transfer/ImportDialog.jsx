import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { downloadErrorRowsCsv } from '@/shared/utils/file'

const DEFAULT_FORMATS = ['csv', 'xlsx']
const DEFAULT_TEMPLATE_OPTIONS = [
  { label: 'XLSX (.xlsx)', value: 'xlsx' },
  { label: 'CSV (.csv)', value: 'csv' },
]

/**
 * 导入弹窗（替代 ImportCsvModal，props 对齐，visible → open）：
 *   <ImportDialog open={open} onOpenChange={setOpen} title="导入用户"
 *     onDownloadTemplate={(fileType) => …} onImport={(file) => api(file)} onImported={() => reload()} />
 * onImport 返回 { created, updated } 显示结果；抛出 { error, error_rows } 时显示失败明细并可下载。
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
  // 状态放在 ImportBody 里：Radix 在关闭时卸载 DialogContent，重新打开即是全新状态
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
      toast.error(`仅支持 ${hint} 文件`)
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{targetLabel ? `导入到：${targetLabel}。` : null}支持 {hint}，单个文件不超过 5MB。</DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
          <span className="text-muted-foreground text-xs">先下载模板，按表头填写后上传</span>
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
              下载模板
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
          <span className="text-sm font-medium">拖拽文件到这里，或点击选择</span>
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
                  <Button variant="ghost" size="icon" className="size-7" aria-label="移除文件" onClick={() => setFile(null)}>
                    <X />
                  </Button>
                ) : null}
              </div>
              {importing || progress > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <div className="text-muted-foreground text-xs">{importing ? '正在导入…' : progress >= 100 ? '导入完成' : ''}</div>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {result ? (
          <div className="bg-success-soft text-success flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px]">
            <CircleCheck className="size-4" />
            导入完成：新增 {result.created || 0} 条，更新 {result.updated || 0} 条
          </div>
        ) : null}
        {!result && errorRows.length > 0 ? (
          <div className="bg-danger-soft flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[13px]">
            <span className="text-danger flex items-center gap-2">
              <TriangleAlert className="size-4" />
              共 {errorRows.length} 行数据有误，未导入任何数据
            </span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => downloadErrorRowsCsv(errorRows, errorExportFileName)}>
              下载失败明细
            </Button>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={onClose}>
            关闭
          </Button>
          <Button disabled={!file || importing} onClick={run}>
            {importing ? <Spinner /> : null}
            开始导入
          </Button>
        </DialogFooter>
    </>
  )
}
