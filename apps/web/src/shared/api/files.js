import request from '@/shared/api/request'

const BASE = '/admin/files'

/** URL that shows / downloads a file (images preview inline) */
export const fileUrl = (id) => `/api${BASE}/${id}`

/**
 * Upload one file to the file center. Resolves to { id, url, original_name, mime_type, size, ... }.
 * onProgress(percent) is called as the upload advances.
 */
export const uploadFile = (file, { onProgress } = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Large files take longer than the default 10s timeout
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  })
}

/** File metadata plus where it is used */
export const getFileInfo = (id) => request.get(`${BASE}/${id}/info`)
export const getFiles = (params) => request.get(BASE, { params })
export const deleteFile = (id) => request.delete(`${BASE}/${id}`)
