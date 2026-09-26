import request from '@/shared/api/request'

const BASE = '/admin/modeler'

/** Field types, parent menus, dictionaries, whether AI is configured, the running job (404 outside development) */
export const getModelerMeta = () => request.get(`${BASE}/meta`)
export const validateSpec = (spec) => request.post(`${BASE}/validate`, { spec })
/** Starts generating; returns the job state */
export const startGenerate = (spec) => request.post(`${BASE}/jobs`, { spec })
/** { job, log: { text, offset } }: log text from `offset` on */
export const getJob = (id, offset = 0) => request.get(`${BASE}/jobs/${id}`, { params: { offset } })
export const getModelerHistory = () => request.get(`${BASE}/history`)
export const undoModule = (name) => request.post(`${BASE}/modules/${name}/undo`)
/** A spec draft from a description (the model may take a while) */
export const suggestSpec = (description) => request.post(`${BASE}/ai/suggest`, { description }, { timeout: 90_000 })
export const translateTexts = (texts) => request.post(`${BASE}/ai/translate`, { texts }, { timeout: 90_000 })
