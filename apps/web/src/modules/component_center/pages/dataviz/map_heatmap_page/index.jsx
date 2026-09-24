import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import chinaGeoJson from './china_geo.json'
import { Button, Spin, Typography, Space, Tag } from '@douyinfe/semi-ui'
import { IconRefresh, IconMapPin } from '@douyinfe/semi-icons'

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.06)',
}

const BASE_DATA = [
  { name: '广东省', value: 12436 }, { name: '江苏省', value: 11637 },
  { name: '山东省', value: 8309 }, { name: '浙江省', value: 7353 },
  { name: '河南省', value: 5888 }, { name: '四川省', value: 5385 },
  { name: '湖北省', value: 5006 }, { name: '福建省', value: 4880 },
  { name: '湖南省', value: 4615 }, { name: '上海市', value: 4321 },
  { name: '安徽省', value: 4504 }, { name: '河北省', value: 4274 },
  { name: '北京市', value: 4026 }, { name: '陕西省', value: 3200 },
  { name: '江西省', value: 3204 }, { name: '重庆市', value: 2900 },
  { name: '辽宁省', value: 2695 }, { name: '云南省', value: 2714 },
  { name: '广西壮族自治区', value: 2601 }, { name: '内蒙古自治区', value: 2268 },
  { name: '贵州省', value: 2201 }, { name: '天津市', value: 1637 },
  { name: '山西省', value: 2312 }, { name: '吉林省', value: 1326 },
  { name: '黑龙江省', value: 1361 }, { name: '新疆维吾尔自治区', value: 1598 },
  { name: '甘肃省', value: 1024 }, { name: '海南省', value: 672 },
  { name: '宁夏回族自治区', value: 500 }, { name: '青海省', value: 349 },
  { name: '西藏自治区', value: 213 },
]

function randomize(base) {
  return base.map(item => ({
    name: item.name,
    value: Math.max(100, item.value + Math.floor((Math.random() - 0.5) * 400)),
  }))
}

export default function MapHeatmapPage() {
  const isMobile = useIsMobile()
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [data, setData] = useState(BASE_DATA)
  const [loading, setLoading] = useState(false)

  // 中国地图 GeoJSON 已下载到本地 china_geo.json（来源：阿里云 DataV，
  // https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json），
  // 避免运行时依赖外部 CDN。
  const refreshTimer = useRef(null)

  useEffect(() => {
    if (echarts.getMap && echarts.getMap('china')) {
      setMapReady(true)
      return
    }
    try {
      echarts.registerMap('china', chinaGeoJson)
      setMapReady(true)
    } catch (err) {
      console.error('地图数据注册失败', err)
      setMapError('地图数据加载失败，请检查本地数据文件')
    }
  }, [])

  // 卸载时清理刷新定时器
  useEffect(() => () => {
    clearTimeout(refreshTimer.current)
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      setData(randomize(BASE_DATA))
      setLoading(false)
      refreshTimer.current = null
    }, 600)
  }

  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top10 = sorted.slice(0, 10)
  const maxVal = sorted[0]?.value || 1

  const mapOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: params => {
        if (!params.value) return params.name
        return `${params.name}<br/>GDP: <b>${params.value.toLocaleString()} 亿元</b>`
      },
    },
    visualMap: {
      min: 0,
      max: maxVal,
      text: ['高', '低'],
      realtime: false,
      calculable: true,
      inRange: { color: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'] },
      bottom: 20,
      left: 20,
    },
    series: [{
      name: 'GDP',
      type: 'map',
      map: 'china',
      roam: true,
      emphasis: { label: { show: true }, itemStyle: { areaColor: '#fff176' } },
      data: data,
      label: { show: false },
    }],
  }

  const barOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 70, right: 16, top: 8, bottom: 8 },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: [...top10].reverse().map(d => d.name),
      axisLabel: { fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: [...top10].reverse().map(d => d.value),
      barMaxWidth: 18,
      itemStyle: {
        color: params => {
          const colors = ['#800026', '#bd0026', '#e31a1c', '#fc4e2a', '#fd8d3c',
                          '#feb24c', '#fed976', '#ffeda0', '#ffffcc', '#fffff5']
          return colors[params.dataIndex] || '#fd8d3c'
        },
        borderRadius: [0, 4, 4, 0],
      },
      label: { show: true, position: 'right', formatter: v => `${(v / 10000).toFixed(1)}万亿` },
    }],
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <IconMapPin size="large" style={{ color: 'var(--semi-color-primary)' }} />
          <Typography.Title heading={4} style={{ margin: 0 }}>地图热力图</Typography.Title>
          {!isMobile && <Tag color="blue">中国各省 GDP 分布（模拟）</Tag>}
        </div>
        <Button icon={<IconRefresh />} onClick={handleRefresh} loading={loading}>刷新数据</Button>
      </div>

      {mapError && (
        <div style={{ ...CARD_STYLE, color: 'var(--semi-color-danger)', marginBottom: 16 }}>
          ⚠️ {mapError}（地图加载失败时，仅显示排行榜）
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 16 }}>
        <div style={CARD_STYLE}>
          {!mapReady && !mapError ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="large" tip="正在加载地图数据..." />
            </div>
          ) : mapError ? (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)' }}>
              地图数据加载失败，请检查网络
            </div>
          ) : (
            <ReactECharts option={mapOption} style={{ height: isMobile ? 280 : 500 }} opts={{ renderer: 'canvas' }} />
          )}
        </div>

        <div style={CARD_STYLE}>
          <Typography.Title heading={6} style={{ marginBottom: 8 }}>Top 10 省份排行</Typography.Title>
          <ReactECharts option={barOption} style={{ height: isMobile ? 260 : 460 }} opts={{ renderer: 'canvas' }} />
        </div>
      </div>

      <Typography.Text type="tertiary" size="small" style={{ marginTop: 8, display: 'block' }}>
        地图数据来源：阿里云 DataV · GDP 数据为模拟数据，仅供展示
      </Typography.Text>
    </div>
  )
}
