import { useRef, useState } from 'react'
import { FileText, UploadCloud, X } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'
import { useUploader } from '@/shared/components/upload/useUploader'

/**
 * Attachment upload: click or drag files onto the drop zone; each file shows its progress.
 * uploadApi(file, { onProgress }) must resolve to an object with `url` (e.g. uploadFile from @/shared/api/files).
 */
export default function FileUpload({
  fileList = [],
  onFileListChange,
  uploadApi,
  limit = 20,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.7z,.json,.ppt,.pptx',
  maxSizeMB = 20,
  promptText = '',
  triggerText = '点击或拖拽文件到这里上传',
  disabled,
}) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const tx = useTx()
  const { addFiles, remove } = useUploader({ fileList, onFileListChange, uploadApi, limit, accept, maxSizeMB, kind: '文件' })
  const full = fileList.length >= limit
  const blocked = disabled || full

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple={limit > 1}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {!disabled ? (
        <button
          type="button"
          disabled={blocked}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!blocked) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!blocked) addFiles(e.dataTransfer.files)
          }}
          className={cn(
            'text-muted-foreground flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-[13px] transition-colors',
            'hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60',
            dragging && 'border-primary bg-brand-soft text-foreground',
          )}
        >
          <UploadCloud className="size-5" />
          <span>{tx(triggerText)}</span>
          {promptText ? <span className="text-xs">{tx(promptText)}</span> : null}
        </button>
      ) : null}
      {fileList.length ? (
        <ul className="divide-y rounded-lg border">
          {fileList.map((f) => (
            <li key={f.uid} className="space-y-1.5 px-3 py-2 text-[13px]">
              <div className="flex items-center gap-2.5">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-primary min-w-0 flex-1 truncate">
                    {f.name}
                  </a>
                ) : (
                  <span className={cn('min-w-0 flex-1 truncate', f.status === 'error' && 'text-danger')}>{f.name}</span>
                )}
                {f.size ? <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatBytes(f.size)}</span> : null}
                {f.status === 'error' ? <span className="text-danger text-xs">{tx('上传失败')}</span> : null}
                {!disabled ? (
                  <button
                    type="button"
                    aria-label={tx('移除 {{name}}', { name: f.name })}
                    onClick={() => remove(f.uid)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              {f.status === 'uploading' ? <Progress value={f.percent || 0} className="h-1" aria-label={tx('上传进度')} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
