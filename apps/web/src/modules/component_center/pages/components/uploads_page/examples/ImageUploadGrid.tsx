import { useState } from 'react'
import { uploadFile, type FileRecord } from '@/shared/api/files'
import ImageUpload from '@/shared/components/upload/ImageUpload'
import type { UploadFileItem } from '@/shared/components/upload/useUploader'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'

export default function ImageUploadGrid() {
  const limits = useUploadLimits()
  const [images, setImages] = useState<UploadFileItem<FileRecord>[]>([])
  // Only finished uploads have a URL; this is what a gallery field would save
  const urls = images.flatMap((image) => (image.status === 'success' && image.url ? [image.url] : []))

  return (
    <div className="space-y-3">
      {/* A local preview shows while uploading; click a thumbnail to open the image, hover it to remove */}
      <ImageUpload
        fileList={images}
        onFileListChange={setImages}
        uploadApi={uploadFile}
        limit={4}
        imageSize={88}
        accept={limits.imageAccept}
        maxSizeMB={limits.maxSizeMB}
        promptText="最多 4 张，支持 JPG / PNG / GIF / WebP"
      />
      <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(urls, null, 2)}</pre>
    </div>
  )
}
