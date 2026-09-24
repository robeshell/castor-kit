import { useRef } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useUploader } from '@/shared/components/upload/useUploader'

/** 附件上传 */
export default function FileUpload({
  fileList = [],
  onFileListChange,
  uploadApi,
  limit = 20,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.7z,.json,.ppt,.pptx',
  maxSizeMB = 20,
  promptText = '',
  triggerText = '上传文件',
  disabled,
}) {
  const inputRef = useRef(null)
  const { addFiles, remove } = useUploader({ fileList, onFileListChange, uploadApi, limit, accept, maxSizeMB, kind: '文件' })
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
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={disabled || fileList.length >= limit} onClick={() => inputRef.current?.click()}>
          <Paperclip />
          {triggerText}
        </Button>
        {promptText ? <span className="text-muted-foreground text-xs">{promptText}</span> : null}
      </div>
      {fileList.length ? (
        <ul className="divide-y rounded-lg border">
          {fileList.map((f) => (
            <li key={f.uid} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
              <FileText className="text-muted-foreground size-4 shrink-0" />
              {f.url ? (
                <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-primary min-w-0 flex-1 truncate">
                  {f.name}
                </a>
              ) : (
                <span className={cn('min-w-0 flex-1 truncate', f.status === 'error' && 'text-danger')}>{f.name}</span>
              )}
              {f.status === 'uploading' ? <Spinner className="size-3.5" /> : null}
              {f.status === 'error' ? <span className="text-danger text-xs">上传失败</span> : null}
              {!disabled ? (
                <button type="button" aria-label={`移除 ${f.name}`} onClick={() => remove(f.uid)} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
