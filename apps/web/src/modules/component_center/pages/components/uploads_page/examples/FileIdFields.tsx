import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fileUrl } from '@/shared/api/files'
import FileIdUpload from '@/shared/components/upload/FileIdUpload'

export default function FileIdFields() {
  const { t } = useTranslation()
  // What a record stores: file-center ids, not URLs; the URL is derived with fileUrl(id) when showing the file
  const [coverId, setCoverId] = useState<string | null>(null)
  const [attachmentIds, setAttachmentIds] = useState<string[]>([])
  // Remounting starts from the ids alone, as an edit form does: names come from GET /api/admin/files/<id>/info
  const [mount, setMount] = useState(0)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <div className="text-[13px] font-medium">{t('封面（单个 id）')}</div>
          {/* Single: onChange gets an id, or null once removed; remove the image to pick another */}
          <FileIdUpload key={mount} variant="image" value={coverId} onChange={(value) => setCoverId(typeof value === 'string' ? value : null)} />
        </div>
        <div className="space-y-1.5">
          <div className="text-[13px] font-medium">{t('附件（id 数组）')}</div>
          {/* multiple: onChange gets the array of ids (up to 20); accept and the size limit default to the server's */}
          <FileIdUpload key={mount} multiple value={attachmentIds} onChange={(value) => setAttachmentIds(Array.isArray(value) ? value : [])} />
        </div>
        <Button variant="outline" size="sm" disabled={!coverId && !attachmentIds.length} onClick={() => setMount((n) => n + 1)}>
          <RotateCw />
          {t('只用 id 重新打开')}
        </Button>
      </div>
      <pre className="bg-muted self-start overflow-x-auto rounded-md p-3 font-mono text-xs">
        {JSON.stringify({ coverId, coverUrl: coverId ? fileUrl(coverId) : null, attachmentIds }, null, 2)}
      </pre>
    </div>
  )
}
