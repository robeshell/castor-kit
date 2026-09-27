// i18n-ignore-file: city names on the globe are demo content, not UI copy

export interface City {
  name: string
  lat: number
  lon: number
}

const beijing: City       = { name: '北京',   lat: 39.9,  lon: 116.4 }
const shanghai: City      = { name: '上海',   lat: 31.2,  lon: 121.5 }
const newYork: City       = { name: '纽约',   lat: 40.7,  lon: -74.0 }
const london: City        = { name: '伦敦',   lat: 51.5,  lon:  -0.1 }
const tokyo: City         = { name: '东京',   lat: 35.7,  lon: 139.7 }
const sydney: City        = { name: '悉尼',   lat: -33.9, lon: 151.2 }
const dubai: City         = { name: '迪拜',   lat: 25.2,  lon:  55.3 }
const paris: City         = { name: '巴黎',   lat: 48.9,  lon:   2.3 }
const singapore: City     = { name: '新加坡', lat:  1.4,  lon: 103.8 }
const sanFrancisco: City  = { name: '旧金山', lat: 37.8,  lon: -122.4 }

export const CITIES: City[] = [beijing, shanghai, newYork, london, tokyo, sydney, dubai, paris, singapore, sanFrancisco]

/** City pairs joined by an arc */
export const ARC_PAIRS: [City, City][] = [
  [beijing, shanghai], [beijing, tokyo], [shanghai, newYork], [newYork, london], [london, paris],
  [tokyo, sydney], [sydney, dubai], [dubai, singapore], [paris, sanFrancisco], [singapore, beijing],
]
