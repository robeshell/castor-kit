/**
 * TODO: replace <resource> with the resource name (kebab-case, e.g. customers)
 * TODO: replace <domain> with the domain path (e.g. admin or component-center)
 */
import request from '@/shared/api/request'

const BASE = '/admin/<resource>'

// ── Basic CRUD ───────────────────────────────────────────────────────────────
export const getItems = (params) => request.get(BASE, { params })
export const createItem = (data) => request.post(BASE, data)
export const updateItem = (id, data) => request.put(`${BASE}/${id}`, data)
export const deleteItem = (id) => request.delete(`${BASE}/${id}`)

// ── Export ───────────────────────────────────────────────────────────────────
export const exportItems = (data) =>
  request.post(`${BASE}/export`, data, { responseType: 'blob' })

// ── Download import template ─────────────────────────────────────────────────
export const downloadTemplate = (fileType = 'xlsx') =>
  request.get(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })

// ── Import ───────────────────────────────────────────────────────────────────
export const importItems = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
