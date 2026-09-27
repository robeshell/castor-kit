import request from '@/shared/api/request'
import type { ListParams, ListResponse } from '@/shared/api/types'

const BASE = '/admin/files'

/** A file in the file center (times are ISO 8601 UTC) */
export interface FileRecord {
  /** UUID */
  id: string
  original_name: string
  mime_type: string
  /** Bytes */
  size: number
  sha256: string
  /** Storage driver name, e.g. local / s3 */
  storage: string
  uploader_id: number | null
  uploader_name: string | null
  /** How many business record fields use this file */
  ref_count: number
  /** Shows / downloads the file (same as fileUrl(id)) */
  url: string
  created_at: string
}

/** A business record field that uses a file */
export interface FileReference {
  ref_table: string
  ref_id: string
  ref_field: string
}

export interface FileInfo extends FileRecord {
  references: FileReference[]
}

export interface UploadOptions {
  /** Called with 0–100 as the upload advances */
  onProgress?: (percent: number) => void
}

/** URL that shows / downloads a file (images preview inline) */
export const fileUrl = (id: string) => `/api${BASE}/${id}`

/**
 * Upload one file to the file center. Resolves to { id, url, original_name, mime_type, size, ... }.
 * onProgress(percent) is called as the upload advances.
 */
export const uploadFile = (file: Blob, { onProgress }: UploadOptions = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<unknown, FileRecord>(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Large files take longer than the default 10s timeout
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  })
}

/** File metadata plus where it is used */
export const getFileInfo = (id: string) => request.get<unknown, FileInfo>(`${BASE}/${id}/info`)
export const getFiles = (params?: ListParams) => request.get<unknown, ListResponse<FileRecord>>(BASE, { params })
export const deleteFile = (id: string) => request.delete<unknown, { message: string }>(`${BASE}/${id}`)
