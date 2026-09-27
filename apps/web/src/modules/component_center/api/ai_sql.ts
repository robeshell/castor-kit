import request from '@/shared/api/request'
import type { ApiBody, ApiResponse } from '@/shared/api/types'

const BASE = '/admin/component-center/ai/sql'

/** Tables the model may query and their schema as text */
export type DbSchema = ApiResponse<'/api/admin/component-center/ai/sql/schema'>
/** A query result: { sql, columns, rows, row_count, truncated } */
export type SqlResult = ApiResponse<'/api/admin/component-center/ai/sql/execute', 'post'>

/** Fetch the database schema */
export const getDBSchema = () => request.get<unknown, DbSchema>(`${BASE}/schema`)

/** Natural language → SQL → execute; returns { sql, columns, rows, row_count } */
// The backend waits up to 30 s for the model (thinking models are slow) and then runs the query, so allow longer than the 10 s default
export const generateSQL = (data: ApiBody<'/api/admin/component-center/ai/sql/generate', 'post'>) =>
  request.post<unknown, ApiResponse<'/api/admin/component-center/ai/sql/generate', 'post'>>(`${BASE}/generate`, data, { timeout: 60_000 })

/** Execute SQL edited by the user; returns { sql, columns, rows, row_count } */
export const executeSQL = (data: ApiBody<'/api/admin/component-center/ai/sql/execute', 'post'>) =>
  request.post<unknown, SqlResult>(`${BASE}/execute`, data)
