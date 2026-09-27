import request from '@/shared/api/request'

export const getTrafficFlowData = () =>
  request.get('/admin/component-center/dataviz/traffic-flow/data')
