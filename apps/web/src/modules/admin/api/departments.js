import request from '@/shared/api/request'

const BASE = '/admin/departments'

/** Department tree: [{ id, name, code, parent_id, leader_id, leader_name, user_count, sort_order, status, children }] */
export const getDepartments = (params) => request.get(BASE, { params })
export const createDepartment = (data) => request.post(BASE, data)
export const updateDepartment = (id, data) => request.put(`${BASE}/${id}`, data)
export const deleteDepartment = (id) => request.delete(`${BASE}/${id}`)
/** direction: 'up' | 'down' */
export const sortDepartment = (id, direction) => request.post(`${BASE}/${id}/sort`, { direction })
