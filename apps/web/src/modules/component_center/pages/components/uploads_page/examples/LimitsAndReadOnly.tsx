import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { uploadFile, type FileRecord } from '@/shared/api/files'
import FileUpload from '@/shared/components/upload/FileUpload'
import type { UploadFileItem } from '@/shared/components/upload/useUploader'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'

export default function LimitsAndReadOnly() {
  const { t } = useTranslation()
  const limits = useUploadLimits()
  const [files, setFiles] = useState<UploadFileItem<FileRecord>[]>([])
  const [readOnly, setReadOnly] = useState(false)

  return (
    <div className="space-y-4">
      {/* The server still checks every upload; these limits only stop a wrong file before it is sent */}
      <p className="text-muted-foreground text-xs">
        {t('服务器限制：单个文件不超过 {{size}}MB，允许 {{types}}', {
          size: limits.maxSizeMB ?? '…',
          types: limits.accept ?? '…',
        })}
      </p>
      <div className="flex items-center gap-2">
        <Switch id="upload-read-only" checked={readOnly} onCheckedChange={setReadOnly} />
        <Label htmlFor="upload-read-only" className="text-[13px] font-normal">
          {t('只读')}
        </Label>
      </div>
      {/* Tighter than the server: 2 files, CSV / TXT, 1 MB each. A wrong type, a bigger file or a third file is refused with a warning */}
      <FileUpload
        fileList={files}
        onFileListChange={setFiles}
        uploadApi={uploadFile}
        limit={2}
        accept=".csv,.txt"
        maxSizeMB={1}
        triggerText="点击或拖拽 CSV / TXT 文件到这里"
        promptText="最多 2 个，每个不超过 1MB"
        // disabled hides the drop zone and the remove buttons; the list stays readable
        disabled={readOnly}
      />
    </div>
  )
}
