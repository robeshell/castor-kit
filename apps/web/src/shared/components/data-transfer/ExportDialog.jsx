import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const DEFAULT_FILE_TYPES = [
  { label: 'Excel', description: '.xlsx', value: 'xlsx' },
  { label: 'CSV', description: '.csv', value: 'csv' },
]

/**
 * Export dialog (replaces ExportFieldsModal with matching props, visible → open):
 *   <ExportDialog open={open} onOpenChange={setOpen} fieldOptions={FIELDS} defaultFields={[…]}
 *     ruleHint="已勾选 3 条" onConfirm={async ({ fields, fileType }) => …} />
 * onConfirm may return a Promise; the caller closes the dialog on success.
 */
export default function ExportDialog({
  open,
  onOpenChange,
  title = '导出数据',
  ruleHint,
  fieldOptions = [],
  defaultFields = [],
  fileTypeOptions = DEFAULT_FILE_TYPES,
  defaultFileType = 'xlsx',
  onConfirm,
}) {
  // State lives in ExportBody: closing unmounts it, and reopening re-initializes from the default fields
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange?.(next)}>
      <DialogContent className="sm:max-w-[520px]">
        <ExportBody
          title={title}
          ruleHint={ruleHint}
          fieldOptions={fieldOptions}
          defaultFields={defaultFields}
          fileTypeOptions={fileTypeOptions}
          defaultFileType={defaultFileType}
          onConfirm={onConfirm}
          onBusyChange={setBusy}
          onClose={() => onOpenChange?.(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ExportBody({ title, ruleHint, fieldOptions, defaultFields, fileTypeOptions, defaultFileType, onConfirm, onBusyChange, onClose }) {
  const tx = useTx()
  const [fields, setFields] = useState(() => (defaultFields?.length ? defaultFields : fieldOptions.map((o) => o.value)))
  const [fileType, setFileType] = useState(
    () => fileTypeOptions.find((o) => o.value === defaultFileType)?.value || fileTypeOptions[0]?.value || 'xlsx',
  )
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    onBusyChange?.(exporting)
  }, [exporting, onBusyChange])

  const toggle = (value, checked) =>
    setFields((prev) => (checked ? (prev.includes(value) ? prev : [...prev, value]) : prev.filter((v) => v !== value)))

  const submit = async () => {
    if (!fields.length) {
      toast.warning('请至少勾选一个导出字段')
      return
    }
    try {
      setExporting(true)
      await onConfirm?.({ fields, fileType })
    } finally {
      setExporting(false)
    }
  }


  return (
    <>
        <DialogHeader>
          <DialogTitle>{tx(title)}</DialogTitle>
          {ruleHint ? <DialogDescription>{tx(ruleHint)}</DialogDescription> : null}
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[13px] font-medium">{tx('文件格式')}</div>
          <div className="grid grid-cols-2 gap-2">
            {fileTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFileType(opt.value)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] transition-all',
                  fileType === opt.value ? 'border-primary bg-brand-soft ring-primary/20 ring-2' : 'hover:bg-muted/50',
                )}
              >
                <span className="font-medium">{tx(opt.label)}</span>
                <span className="text-muted-foreground font-mono text-xs">{tx(opt.description) || `.${opt.value}`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">
              {tx('导出字段')} <span className="text-muted-foreground font-normal">({fields.length}/{fieldOptions.length})</span>
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFields(fieldOptions.map((o) => o.value))}>
                {tx('全选')}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFields([])}>
                {tx('清空')}
              </Button>
            </div>
          </div>
          <div className="grid max-h-64 grid-cols-2 gap-x-4 gap-y-2.5 overflow-y-auto rounded-lg border p-3">
            {fieldOptions.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-[13px]">
                <Checkbox checked={fields.includes(opt.value)} onCheckedChange={(c) => toggle(opt.value, c === true)} />
                <span className="truncate">{tx(opt.label)}</span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={exporting} onClick={onClose}>
            {tx('取消')}
          </Button>
          <Button onClick={submit} disabled={exporting}>
            {exporting ? <Spinner /> : null}
            {tx('导出')}
          </Button>
        </DialogFooter>
    </>
  )
}
