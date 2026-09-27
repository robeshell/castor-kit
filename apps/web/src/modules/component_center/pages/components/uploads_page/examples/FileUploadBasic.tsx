import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uploadFile, type FileRecord } from '@/shared/api/files'
import FileUpload from '@/shared/components/upload/FileUpload'
import type { UploadFileItem } from '@/shared/components/upload/useUploader'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'

export default function FileUploadBasic() {
  const { t } = useTranslation()
  // The server's limits (system settings → upload); undefined until app-info loads, then the component defaults apply
  const limits = useUploadLimits()
  // Typed by what uploadApi resolves to: uploadFile gives a FileRecord, so response.id is the file-center id
  const [files, setFiles] = useState<UploadFileItem<FileRecord>[]>([])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <FileUpload
        fileList={files}
        onFileListChange={setFiles}
        // Uploads right away to the file center (POST /api/admin/files) and reports progress
        uploadApi={uploadFile}
        limit={5}
        accept={limits.accept}
        maxSizeMB={limits.maxSizeMB}
        promptText={limits.maxSizeMB ? t('最多 5 个，每个不超过 {{size}}MB', { size: limits.maxSizeMB }) : ''}
      />
      {/* What the page gets for each file: status, the file-center id and the URL that shows it */}
      <ul className="bg-muted self-start space-y-2 rounded-md p-3 font-mono text-xs">
        {files.length ? (
          files.map((f) => (
            <li key={f.uid} className="space-y-0.5 break-all">
              <div>
                {f.name} · {f.status}
                {f.status === 'uploading' ? ` ${f.percent ?? 0}%` : ''}
              </div>
              {f.response ? <div className="text-muted-foreground">id: {f.response.id}</div> : null}
              {f.url ? <div className="text-muted-foreground">url: {f.url}</div> : null}
            </li>
          ))
        ) : (
          <li className="text-muted-foreground">fileList: []</li>
        )}
      </ul>
    </div>
  )
}
