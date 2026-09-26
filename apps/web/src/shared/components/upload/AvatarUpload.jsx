import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import i18n from '@/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/shared/api/files'
import UserAvatar from '@/shared/components/UserAvatar'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'

const DEFAULT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

/**
 * Avatar picker: uploads an image to the file center and reports its URL (/api/admin/files/<id>) through onChange.
 * value is the current avatar URL (older records may hold an external URL, which still displays).
 */
export default function AvatarUpload({ value, onChange, name, maxSizeMB, disabled, className, ...rest }) {
  const tx = useTx()
  const limits = useUploadLimits()
  // Server limits win once app-info has loaded; images the server doesn't allow aren't offered
  const extensions = limits.imageAccept ? limits.imageAccept.split(',') : DEFAULT_IMAGE_EXTENSIONS
  const sizeLimit = maxSizeMB ?? limits.maxSizeMB ?? 5
  const inputRef = useRef(null)
  const [percent, setPercent] = useState(null)
  const uploading = percent !== null

  const pick = async (file) => {
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!extensions.some((ext) => lower.endsWith(ext))) {
      toast.warning(i18n.t('{{kind}}类型不支持', { kind: i18n.t('图片') }))
      return
    }
    if (file.size > sizeLimit * 1024 * 1024) {
      toast.warning(i18n.t('{{kind}}不能超过 {{size}}MB', { kind: i18n.t('图片'), size: sizeLimit }))
      return
    }
    setPercent(0)
    try {
      const res = await uploadFile(file, { onProgress: setPercent })
      onChange?.(res.url)
    } catch (err) {
      toast.apiError(err, '上传失败')
    } finally {
      setPercent(null)
    }
  }

  return (
    <div className={cn('flex items-center gap-3', className)} {...rest}>
      <input
        ref={inputRef}
        type="file"
        accept={extensions.join(',')}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="relative">
        <UserAvatar src={value || undefined} name={name} className="size-14" fallbackClassName="text-lg" />
        {uploading ? (
          <div className="bg-background/70 absolute inset-0 flex items-center justify-center rounded-full">
            {percent ? <span className="text-[11px] font-medium tabular-nums">{percent}%</span> : <Spinner />}
          </div>
        ) : null}
      </div>
      {!disabled ? (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Camera />
            {value ? tx('更换头像') : tx('上传头像')}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={uploading} onClick={() => onChange?.('')}>
              <Trash2 />
              {tx('移除')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
