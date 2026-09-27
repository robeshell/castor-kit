import request from '@/shared/api/request'
import type { ApiBody, ApiQuery, ApiResponse } from '@/shared/api/types'

const BASE = '/admin/departments'

/** A department record (as returned by create / update; times are ISO 8601 UTC) */
export type Department = ApiResponse<'/api/admin/departments', 'post'>

/**
 * A node of the department tree. Local type: the OpenAPI doc can't express the recursive `children` (it has
 * `{ [key: string]: unknown }[]`) and adds an index signature.
 */
export interface DepartmentNode extends Department {
  leader_name: string | null
  user_count: number
  children?: DepartmentNode[]
}

/**
 * Tree query: search (name / code) and status.
 * TODO(openapi): the backend reads `status` as free text and lists every status for '' or any other value
 * (apps/api/src/modules/admin/departments/routes.ts); the doc only allows the enum, but the departments page sends ''.
 */
export type DepartmentQuery = Omit<ApiQuery<'/api/admin/departments'>, 'status'> & { status?: string }

/** Department tree: [{ id, name, code, parent_id, leader_id, leader_name, user_count, sort_order, status, children }] */
export const getDepartments = (params?: DepartmentQuery) => request.get<unknown, DepartmentNode[]>(BASE, { params })
export const createDepartment = (data: ApiBody<'/api/admin/departments', 'post'>) => request.post<unknown, Department>(BASE, data)
export const updateDepartment = (id: number, data: ApiBody<'/api/admin/departments/{dept_id}', 'put'>) =>
  request.put<unknown, ApiResponse<'/api/admin/departments/{dept_id}', 'put'>>(`${BASE}/${id}`, data)
export const deleteDepartment = (id: number) =>
  request.delete<unknown, ApiResponse<'/api/admin/departments/{dept_id}', 'delete'>>(`${BASE}/${id}`)
/** direction: 'up' | 'down' */
export const sortDepartment = (id: number, direction: ApiBody<'/api/admin/departments/{dept_id}/sort', 'post'>['direction']) =>
  request.post<unknown, ApiResponse<'/api/admin/departments/{dept_id}/sort', 'post'>>(`${BASE}/${id}/sort`, { direction })
