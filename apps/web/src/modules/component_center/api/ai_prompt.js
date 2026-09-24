import request from '@/shared/api/request'

const BASE = '/admin/component-center/ai/prompt'

/** 获取模板列表（可选按 category 过滤） */
export const getPromptTemplates = (params) => request.get(`${BASE}/templates`, { params })

/** 新建模板 */
export const createPromptTemplate = (data) => request.post(`${BASE}/templates`, data)

/** 更新模板 */
export const updatePromptTemplate = (id, data) => request.put(`${BASE}/templates/${id}`, data)

/** 删除模板 */
export const deletePromptTemplate = (id) => request.delete(`${BASE}/templates/${id}`)
