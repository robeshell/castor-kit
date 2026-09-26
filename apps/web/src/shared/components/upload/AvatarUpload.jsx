import { useRef, useState } from 'react'
import { Camera, Link2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import i18n from '@/i18n'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { uploadFile } from '@/shared/api/files'
import UserAvatar from '@/shared/components/UserAvatar'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'

const DEFAULT_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
// Same rule as the API (users/schema.ts normalizeProfile): an absolute http(s) URL or a site path
const AVATAR_URL_RE = /^(https?:\/\/|\/)\S+$/

/**
 * Avatar picker: uploads an image to the file center and reports its URL (/api/admin/files/<id>) through onChange,
 * or takes an image URL typed in by hand. value is the current avatar URL.
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
  /** null = not editing; otherwise the URL being typed */
  const [urlDraft, setUrlDraft] = useState(null)
  const urlInvalid = urlDraft !== null && urlDraft.trim() !== '' && !AVATAR_URL_RE.test(urlDraft.trim())

  const applyUrl = () => {
    const url = urlDraft.trim()
    if (!url || urlInvalid) return
    onChange?.(url)
    setUrlDraft(null)
  }

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
      {!disabled && urlDraft === null ? (
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            <Camera />
            {value ? tx('更换头像') : tx('上传头像')}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={uploading} onClick={() => setUrlDraft('')}>
            <Link2 />
            {tx('填写图片地址')}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={uploading} onClick={() => onChange?.('')}>
              <Trash2 />
              {tx('移除')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!disabled && urlDraft !== null ? (
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyUrl()
                }
                if (e.key === 'Escape') setUrlDraft(null)
              }}
              placeholder={tx('https://… 或 /…')}
              aria-label={tx('图片地址')}
              aria-invalid={urlInvalid || undefined}
              className="h-8 min-w-0 flex-1"
            />
            <Button type="button" size="sm" variant="outline" disabled={!urlDraft.trim() || urlInvalid} onClick={applyUrl}>
              {tx('使用')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setUrlDraft(null)}>
              {tx('取消')}
            </Button>
          </div>
          {urlInvalid ? <p className="text-danger text-xs">{tx('头像地址需以 http(s):// 或 / 开头')}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
