import { useEffect, useMemo, useState } from 'react'
import { fileUrl, getFileInfo, uploadFile } from '@/shared/api/files'
import type { FileRecord } from '@/shared/api/files'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'
import FileUpload from '@/shared/components/upload/FileUpload'
import ImageUpload from '@/shared/components/upload/ImageUpload'
import type { UploadFileItem } from '@/shared/components/upload/useUploader'

/** A file-center id, a list of them (`multiple`), or nothing */
export type FileIdValue = string | string[] | null

export interface FileIdUploadProps {
  /** A single id (or null / '') by default; an array of ids with `multiple` */
  value?: FileIdValue
  /** Called with an id or null, or with an array of ids when `multiple` */
  onChange?: (value: string | string[] | null) => void
  /** Attachment list or image thumbnail grid */
  variant?: 'file' | 'image'
  multiple?: boolean
  /** Accepted extensions (default: the server's allowed types) */
  accept?: string
  maxSizeMB?: number
  disabled?: boolean
}

/** Name / size of a file id, as far as we know it */
interface FileMeta {
  name: string
  size?: number
}

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp'

const idsOf = (value: FileIdValue | undefined): string[] => (Array.isArray(value) ? value : value ? [value] : [])

/**
 * Upload field whose value is file-center ids: a single id (or null) by default, an array with `multiple`.
 * The visible list is derived from `value`; names of ids we haven't seen are looked up through /files/<id>/info,
 * so edit forms show what is already attached.
 */
export default function FileIdUpload({ value, onChange, variant = 'file', multiple = false, accept, maxSizeMB, disabled }: FileIdUploadProps) {
  const limits = useUploadLimits()
  const ids = idsOf(value)
  const idsKey = ids.join(',')
  /** id → { name, size } */
  const [info, setInfo] = useState<Partial<Record<string, FileMeta>>>({})
  /** Files still uploading (not in `value` yet) */
  const [pending, setPending] = useState<UploadFileItem<FileRecord>[]>([])

  useEffect(() => {
    const unknown = idsKey ? idsKey.split(',').filter((id) => !info[id]) : []
    if (unknown.length === 0) return undefined
    let cancelled = false
    Promise.all(unknown.map((id) => getFileInfo(id).catch(() => null))).then((results) => {
      if (cancelled) return
      setInfo((prev) => ({
        ...prev,
        ...Object.fromEntries(unknown.map((id, i) => [id, results[i] ? { name: results[i].original_name, size: results[i].size } : { name: id }])),
      }))
    })
    return () => {
      cancelled = true
    }
  }, [idsKey, info])

  const fileList = useMemo<UploadFileItem<FileRecord>[]>(
    () => [
      ...ids.map((id): UploadFileItem<FileRecord> => ({ uid: id, fileId: id, name: info[id]?.name ?? '…', size: info[id]?.size, url: fileUrl(id), status: 'success' })),
      ...pending,
    ],
    // ids is derived from idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, info, pending],
  )

  const handleChange = (list: UploadFileItem<FileRecord>[]) => {
    // Finished uploads, not in `value` yet: their new file ids
    const uploaded = list.flatMap((f) =>
      !f.fileId && f.status === 'success' && f.response?.id ? [{ id: f.response.id, name: f.name, size: f.size }] : [],
    )
    if (uploaded.length) {
      setInfo((prev) => ({ ...prev, ...Object.fromEntries(uploaded.map((f) => [f.id, { name: f.name, size: f.size }])) }))
    }
    setPending(list.filter((f) => !f.fileId && f.status !== 'success'))
    const next = [...list.flatMap((f) => (f.fileId ? [f.fileId] : [])), ...uploaded.map((f) => f.id)]
    if (next.join(',') !== idsKey) onChange?.(multiple ? next : (next.at(-1) ?? null))
  }

  const Component = variant === 'image' ? ImageUpload : FileUpload
  return (
    <Component
      fileList={fileList}
      onFileListChange={handleChange}
      uploadApi={uploadFile}
      limit={multiple ? 20 : 1}
      accept={accept || (variant === 'image' ? limits.imageAccept || IMAGE_ACCEPT : limits.accept)}
      maxSizeMB={maxSizeMB ?? limits.maxSizeMB}
      disabled={disabled}
    />
  )
}
