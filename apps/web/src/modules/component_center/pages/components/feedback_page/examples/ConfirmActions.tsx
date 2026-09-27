import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Megaphone, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import ConfirmAction from '@/shared/components/ConfirmAction'

/** What request.ts rejects with when the API answers with an error: the response body */
interface ApiErrorBody {
  error: string
}

// Stand-ins for API calls: one succeeds after a delay, one fails the way the API does
const deleteReport = () => new Promise<void>((resolve) => setTimeout(resolve, 800))
const deleteFolder = () =>
  new Promise<void>((_, reject) => setTimeout(() => reject({ error: '文件夹不为空，无法删除' } satisfies ApiErrorBody), 800))
const publishNotice = () => new Promise<void>((resolve) => setTimeout(resolve, 600))

export default function ConfirmActions() {
  const { t } = useTranslation()
  const [deleted, setDeleted] = useState(false)

  // Returning the promise keeps the dialog open with a spinner until it settles
  const removeReport = async () => {
    await deleteReport()
    setDeleted(true)
    toast.success('已删除')
  }

  // On failure: show the API message, then rethrow so the dialog stays open and the user can cancel or retry
  const removeFolder = async () => {
    try {
      await deleteFolder()
      toast.success('已删除')
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const publish = async () => {
    await publishNotice()
    toast.success('公告已发布')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {deleted ? (
        <Button variant="ghost" size="sm" onClick={() => setDeleted(false)}>
          <RotateCcw />
          {t('恢复示例')}
        </Button>
      ) : (
        <ConfirmAction title="删除这份报表？" description="删除后不可恢复。" confirmText="删除" onConfirm={removeReport}>
          <Button variant="outline" size="sm" className="text-danger hover:text-danger">
            <Trash2 />
            {t('删除报表')}
          </Button>
        </ConfirmAction>
      )}

      <ConfirmAction title="删除这个文件夹？" description="文件夹里的文件会一起删除。" confirmText="删除" onConfirm={removeFolder}>
        <Button variant="outline" size="sm" className="text-danger hover:text-danger">
          <Archive />
          {t('删除文件夹（会失败）')}
        </Button>
      </ConfirmAction>

      {/* Not dangerous, still worth a second look: destructive={false} gives a primary confirm button */}
      <ConfirmAction
        title="发布这条公告？"
        description="发布后所有用户都会收到通知。"
        confirmText="发布"
        destructive={false}
        onConfirm={publish}
      >
        <Button variant="outline" size="sm">
          <Megaphone />
          {t('发布公告')}
        </Button>
      </ConfirmAction>
    </div>
  )
}
