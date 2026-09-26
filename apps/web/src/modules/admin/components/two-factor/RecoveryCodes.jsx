import { Copy, Download, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { downloadBlobFile } from '@/shared/utils/file'

/** Recovery codes right after they are generated: the only time they can be seen */
export default function RecoveryCodes({ codes = [] }) {
  const { t } = useTranslation()
  const text = codes.join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制')
    } catch {
      toast.error('复制失败，请手动选择复制')
    }
  }

  return (
    <div className="space-y-3">
      <div className="bg-warning-soft text-foreground flex gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
        <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" />
        <span>{t('恢复码只显示这一次。请保存在安全的地方：手机丢失时，每个恢复码可代替验证码登录一次。')}</span>
      </div>
      <ol className="bg-muted/50 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border px-4 py-3 font-mono text-[13px] tabular-nums">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy />
          {t('复制')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadBlobFile(new Blob([`${text}\n`], { type: 'text/plain' }), 'castor-kit-recovery-codes.txt')}
        >
          <Download />
          {t('下载')}
        </Button>
      </div>
    </div>
  )
}
