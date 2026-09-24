import request from '@/shared/api/request'

export const getMapHeatmapData = () =>
  request.get('/admin/component-center/dataviz/map-heatmap/data')
