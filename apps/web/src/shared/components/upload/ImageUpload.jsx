import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'
import { useUploader } from '@/shared/components/upload/useUploader'

/** 图片上传：缩略图网格 + 点击放大预览 */
export default function ImageUpload({
  fileList = [],
  onFileListChange,
  uploadApi,
  limit = 9,
  accept = '.jpg,.jpeg,.png,.gif,.webp',
  maxSizeMB = 5,
  promptText = '',
  imageSize = 96,
  disabled,
}) {
  const inputRef = useRef(null)
  const tx = useTx()
  const { addFiles, remove } = useUploader({ fileList, onFileListChange, uploadApi, limit, accept, maxSizeMB, kind: '图片' })
  const box = { width: imageSize, height: imageSize }
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap gap-2">
        {fileList.map((f) => {
          const src = f.url || f.response?.url || f.preview
          return (
            <div key={f.uid} style={box} className="group bg-muted relative overflow-hidden rounded-lg ring-1 ring-border">
              {src ? (
                <a href={f.url || src} target="_blank" rel="noreferrer">
                  <img src={src} alt={f.name} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                </a>
              ) : null}
              {f.status === 'uploading' ? (
                <div className="bg-background/60 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
                  <Spinner />
                </div>
              ) : null}
              {f.status === 'error' ? (
                <div className="bg-danger-soft text-danger absolute inset-x-0 bottom-0 py-0.5 text-center text-[10px]">{tx('上传失败')}</div>
              ) : null}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={tx('移除图片')}
                  onClick={() => remove(f.uid)}
                  className="bg-background/90 absolute top-1 right-1 flex size-5 items-center justify-center rounded-full opacity-0 shadow transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          )
        })}
        {!disabled && fileList.length < limit ? (
          <button
            type="button"
            style={box}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'text-muted-foreground hover:border-primary hover:text-primary flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors',
            )}
          >
            <ImagePlus className="size-5" />
            {tx('上传')}
          </button>
        ) : null}
      </div>
      {promptText ? <p className="text-muted-foreground text-xs">{promptText}</p> : null}
    </div>
  )
}
