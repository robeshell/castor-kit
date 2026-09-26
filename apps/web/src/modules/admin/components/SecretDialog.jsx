import { Copy, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/lib/toast'

/**
 * Shows a secret (a new API token, a webhook signing secret) with a copy button.
 * `warning` explains when it can be seen again; `children` adds usage notes under it.
 */
export default function SecretDialog({ open, onOpenChange, title, description, secret, warning, doneText = '完成', children }) {
  const { t } = useTranslation()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      toast.success('已复制')
    } catch {
      toast.error('复制失败，请手动选择复制')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t(title)}</DialogTitle>
          {description ? <DialogDescription>{t(description)}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          {warning ? (
            <div className="bg-warning-soft text-foreground flex gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
              <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" />
              <span>{t(warning)}</span>
            </div>
          ) : null}
          <div className="bg-muted/50 flex items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-3">
            <code className="min-w-0 flex-1 font-mono text-[13px] break-all select-all">{secret}</code>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copy}>
              <Copy />
              {t('复制')}
            </Button>
          </div>
          {children}
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t(doneText)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
