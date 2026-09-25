/**
 * Map heatmap mock data: per-province base values (PROVINCE_DATA)
 */

export interface ProvincePoint {
  name: string
  value: number
  lat: number
  lng: number
}

export const PROVINCE_DATA: readonly ProvincePoint[] = [
  { name: '广东', value: 12436, lat: 23.13, lng: 113.26 },
  { name: '江苏', value: 11637, lat: 32.06, lng: 118.77 },
  { name: '山东', value: 8309, lat: 36.67, lng: 117.02 },
  { name: '浙江', value: 7353, lat: 30.29, lng: 120.16 },
  { name: '河南', value: 5888, lat: 34.75, lng: 113.65 },
  { name: '四川', value: 5385, lat: 30.65, lng: 104.07 },
  { name: '湖北', value: 5006, lat: 30.60, lng: 114.31 },
  { name: '福建', value: 4880, lat: 26.08, lng: 119.30 },
  { name: '湖南', value: 4615, lat: 28.23, lng: 112.93 },
  { name: '上海', value: 4321, lat: 31.23, lng: 121.47 },
  { name: '安徽', value: 4504, lat: 31.86, lng: 117.28 },
  { name: '河北', value: 4274, lat: 38.04, lng: 114.51 },
  { name: '北京', value: 4026, lat: 39.92, lng: 116.46 },
  { name: '陕西', value: 3200, lat: 34.27, lng: 108.95 },
  { name: '江西', value: 3204, lat: 28.68, lng: 115.89 },
  { name: '重庆', value: 2900, lat: 29.56, lng: 106.55 },
  { name: '辽宁', value: 2695, lat: 41.83, lng: 123.43 },
  { name: '云南', value: 2714, lat: 25.04, lng: 102.71 },
  { name: '广西', value: 2601, lat: 22.84, lng: 108.37 },
  { name: '内蒙古', value: 2268, lat: 40.82, lng: 111.65 },
  { name: '贵州', value: 2201, lat: 26.60, lng: 106.71 },
  { name: '天津', value: 1637, lat: 39.14, lng: 117.19 },
  { name: '山西', value: 2312, lat: 37.86, lng: 112.55 },
  { name: '吉林', value: 1326, lat: 43.88, lng: 125.35 },
  { name: '黑龙江', value: 1361, lat: 45.74, lng: 126.64 },
  { name: '新疆', value: 1598, lat: 43.79, lng: 87.62 },
  { name: '甘肃', value: 1024, lat: 36.06, lng: 103.83 },
  { name: '海南', value: 672, lat: 20.02, lng: 110.35 },
  { name: '宁夏', value: 500, lat: 38.47, lng: 106.27 },
  { name: '青海', value: 349, lat: 36.62, lng: 101.78 },
  { name: '西藏', value: 213, lat: 29.64, lng: 91.12 },
]
