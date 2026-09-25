import request from '@/shared/api/request'

const BASE = '/admin/component-center/ai/sql'

/** Fetch the database schema */
export const getDBSchema = () => request.get(`${BASE}/schema`)

/** Natural language → SQL → execute; returns { sql, columns, rows, row_count } */
// The backend waits up to 30 s for the model (thinking models are slow) and then runs the query, so allow longer than the 10 s default
export const generateSQL = (data) => request.post(`${BASE}/generate`, data, { timeout: 60_000 })

/** Execute SQL edited by the user; returns { sql, columns, rows, row_count } */
export const executeSQL = (data) => request.post(`${BASE}/execute`, data)
