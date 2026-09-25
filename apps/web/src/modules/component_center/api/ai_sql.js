import request from '@/shared/api/request'

const BASE = '/admin/component-center/ai/sql'

/** Fetch the database schema */
export const getDBSchema = () => request.get(`${BASE}/schema`)

/** Natural language → SQL → execute; returns { sql, columns, rows, row_count } */
export const generateSQL = (data) => request.post(`${BASE}/generate`, data)

/** Execute SQL edited by the user; returns { sql, columns, rows, row_count } */
export const executeSQL = (data) => request.post(`${BASE}/execute`, data)
