import request from '@/shared/api/request'

export const getDetailMembers = (params) =>
  request.get('/admin/component-center/detail-tabs/members', { params })

export const getDetailMember = (id) =>
  request.get(`/admin/component-center/detail-tabs/members/${id}`)

export const createDetailMember = (data) =>
  request.post('/admin/component-center/detail-tabs/members', data)

export const updateDetailMember = (id, data) =>
  request.put(`/admin/component-center/detail-tabs/members/${id}`, data)

export const deleteDetailMember = (id) =>
  request.delete(`/admin/component-center/detail-tabs/members/${id}`)
