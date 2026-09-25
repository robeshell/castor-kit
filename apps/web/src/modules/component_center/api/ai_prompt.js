import request from '@/shared/api/request'

const BASE = '/admin/component-center/ai/prompt'

/** List templates (optionally filtered by category) */
export const getPromptTemplates = (params) => request.get(`${BASE}/templates`, { params })

/** Create a template */
export const createPromptTemplate = (data) => request.post(`${BASE}/templates`, data)

/** Update a template */
export const updatePromptTemplate = (id, data) => request.put(`${BASE}/templates/${id}`, data)

/** Delete a template */
export const deletePromptTemplate = (id) => request.delete(`${BASE}/templates/${id}`)
