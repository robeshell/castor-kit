/**
 * TODO: 替换 <resource> 为资源名（kebab-case，如 customers）
 * TODO: 替换 <domain> 为域路径（如 admin 或 component-center）
 */
import request from '@/shared/api/request'

const BASE = '/admin/<resource>'

// ── 基础 CRUD ────────────────────────────────────────────────────────────────
export const getItems = (params) => request.get(BASE, { params })
export const createItem = (data) => request.post(BASE, data)
export const updateItem = (id, data) => request.put(`${BASE}/${id}`, data)
export const deleteItem = (id) => request.delete(`${BASE}/${id}`)

// ── 导出 ─────────────────────────────────────────────────────────────────────
export const exportItems = (data) =>
  request.post(`${BASE}/export`, data, { responseType: 'blob' })

// ── 下载导入模板 ──────────────────────────────────────────────────────────────
export const downloadTemplate = (fileType = 'xlsx') =>
  request.get(`${BASE}/template`, { params: { file_type: fileType }, responseType: 'blob' })

// ── 导入 ─────────────────────────────────────────────────────────────────────
export const importItems = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post(`${BASE}/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
