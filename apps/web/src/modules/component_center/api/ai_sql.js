import request from '@/shared/api/request'

const BASE = '/admin/component-center/ai/sql'

/** 获取数据库表结构 */
export const getDBSchema = () => request.get(`${BASE}/schema`)

/** 自然语言 → SQL → 执行，返回 { sql, columns, rows, row_count } */
export const generateSQL = (data) => request.post(`${BASE}/generate`, data)

/** 执行用户手动编辑的 SQL，返回 { sql, columns, rows, row_count } */
export const executeSQL = (data) => request.post(`${BASE}/execute`, data)
