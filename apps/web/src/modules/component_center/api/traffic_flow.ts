import request from '@/shared/api/request'
import type { ApiResponse } from '@/shared/api/types'

/** Sankey links and funnel stages for the traffic flow chart */
export type TrafficFlowData = ApiResponse<'/api/admin/component-center/dataviz/traffic-flow/data'>

export const getTrafficFlowData = () =>
  request.get<unknown, TrafficFlowData>('/admin/component-center/dataviz/traffic-flow/data')
