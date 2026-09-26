import { useEffect, useMemo, useState } from 'react'
import { fileUrl, getFileInfo, uploadFile } from '@/shared/api/files'
import FileUpload from '@/shared/components/upload/FileUpload'
import ImageUpload from '@/shared/components/upload/ImageUpload'

const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp'

const idsOf = (value) => (Array.isArray(value) ? value : value ? [value] : [])

/**
 * Upload field whose value is file-center ids: a single id (or null) by default, an array with `multiple`.
 * The visible list is derived from `value`; names of ids we haven't seen are looked up through /files/<id>/info,
 * so edit forms show what is already attached.
 */
export default function FileIdUpload({ value, onChange, variant = 'file', multiple = false, accept, maxSizeMB, disabled }) {
  const ids = idsOf(value)
  const idsKey = ids.join(',')
  /** id → { name, size } */
  const [info, setInfo] = useState({})
  /** Files still uploading (not in `value` yet) */
  const [pending, setPending] = useState([])

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

  const fileList = useMemo(
    () => [
      ...ids.map((id) => ({ uid: id, fileId: id, name: info[id]?.name ?? '…', size: info[id]?.size, url: fileUrl(id), status: 'success' })),
      ...pending,
    ],
    // ids is derived from idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey, info, pending],
  )

  const handleChange = (list) => {
    const uploaded = list.filter((f) => !f.fileId && f.status === 'success' && f.response?.id)
    if (uploaded.length) {
      setInfo((prev) => ({ ...prev, ...Object.fromEntries(uploaded.map((f) => [f.response.id, { name: f.name, size: f.size }])) }))
    }
    setPending(list.filter((f) => !f.fileId && f.status !== 'success'))
    const next = [...list.filter((f) => f.fileId).map((f) => f.fileId), ...uploaded.map((f) => f.response.id)]
    if (next.join(',') !== idsKey) onChange?.(multiple ? next : (next.at(-1) ?? null))
  }

  const Component = variant === 'image' ? ImageUpload : FileUpload
  return (
    <Component
      fileList={fileList}
      onFileListChange={handleChange}
      uploadApi={uploadFile}
      limit={multiple ? 20 : 1}
      accept={accept || (variant === 'image' ? IMAGE_ACCEPT : undefined)}
      maxSizeMB={maxSizeMB}
      disabled={disabled}
    />
  )
}
