import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { AlertTriangle, MapPin, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { toast } from '@/lib/toast'
import { getMapHeatmapData } from '@/modules/component_center/api/map_heatmap'
import EmptyState from '@/shared/components/EmptyState'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import chinaGeoJson from './china_geo.json'

// 中国地图 GeoJSON 已下载到本地 china_geo.json（来源：阿里云 DataV，
// https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json），避免运行时依赖外部 CDN。
// 模块加载时注册一次，失败时页面降级为只显示排行榜。
let MAP_ERROR = null
try {
  if (!echarts.getMap?.('china')) echarts.registerMap('china', chinaGeoJson)
} catch (err) {
  console.error('地图数据注册失败', err)
  MAP_ERROR = '地图数据加载失败，请检查本地数据文件'
}

// 接口返回简称（广东、内蒙古…），GeoJSON 用全称（广东省、内蒙古自治区…）：用前缀匹配建立 全称 → 简称 映射
const GEO_NAMES = (chinaGeoJson.features || []).map((f) => f.properties?.name).filter(Boolean)
function buildNameMap(items) {
  const map = {}
  for (const item of items) {
    const full = GEO_NAMES.find((n) => n.startsWith(item.name))
    if (full) map[full] = item.name
  }
  return map
}

export default function MapHeatmapPage() {
  const isMobile = useIsMobile()
  const c = useChartColors()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  // 只在异步回调里 setState；刷新时先置 loading 再拉取
  const load = useCallback(
    () =>
      getMapHeatmapData()
        .then((res) => setData(Array.isArray(res?.data) ? res.data : []))
        .catch((err) => toast.apiError(err, '获取地图数据失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  const handleRefresh = () => {
    setLoading(true)
    load()
  }

  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data])
  const top10 = sorted.slice(0, 10)
  const maxVal = sorted[0]?.value || 1
  const nameMap = useMemo(() => buildNameMap(data), [data])

  const mapOption = useMemo(() => {
    const base = chartBase(c)
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (params) => {
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
        itemWidth: 10,
        itemHeight: 120,
        textStyle: { color: c['muted-foreground'], fontSize: 11 },
        inRange: {
          color: [
            hexToRgba(c['brand-to'], 0.18),
            hexToRgba(c['brand-to'], 0.55),
            hexToRgba(c['brand-via'], 0.75),
            c['brand-via'],
            c['brand-from'],
          ],
        },
        bottom: 12,
        left: 12,
      },
      series: [
        {
          name: 'GDP',
          type: 'map',
          map: 'china',
          roam: true,
          layoutCenter: ['50%', '54%'],
          layoutSize: isMobile ? '100%' : '118%',
          nameMap,
          data,
          label: { show: false },
          itemStyle: { areaColor: hexToRgba(c['muted-foreground'], 0.1), borderColor: c.card, borderWidth: 0.8 },
          emphasis: {
            label: { show: true, color: c.foreground, fontSize: 11 },
            itemStyle: { areaColor: c['brand-to'], borderColor: c.card },
          },
          select: { disabled: true },
        },
      ],
    }
  }, [c, data, maxVal, nameMap, isMobile])

  const barOption = useMemo(() => {
    const base = chartBase(c)
    const reversed = [...top10].reverse()
    return {
      ...base,
      tooltip: { ...base.tooltip, axisPointer: { type: 'shadow', shadowStyle: { color: hexToRgba(c['muted-foreground'], 0.08) } } },
      grid: { left: 4, right: 56, top: 4, bottom: 4, containLabel: true },
      xAxis: { type: 'value', show: false },
      yAxis: {
        ...base.yAxis,
        type: 'category',
        data: reversed.map((d) => d.name),
        splitLine: { show: false },
        axisLabel: { ...base.yAxis.axisLabel, fontSize: 12, color: c.foreground },
      },
      series: [
        {
          type: 'bar',
          data: reversed.map((d) => d.value),
          barMaxWidth: 14,
          itemStyle: {
            // 排名越靠前颜色越深（反转后 dataIndex 越大排名越高）
            color: (params) => hexToRgba(c['brand-from'], 0.3 + (0.7 * (params.dataIndex + 1)) / Math.max(reversed.length, 1)),
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            color: c['muted-foreground'],
            fontSize: 11,
            formatter: (p) => `${(p.value / 10000).toFixed(1)}万亿`,
          },
        },
      ],
    }
  }, [c, top10])

  const mapHeight = isMobile ? 300 : 500

  return (
    <div className="space-y-5">
      <PageHeader
        title="地图热力图"
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw />}
            刷新数据
          </Button>
        }
      />

      {MAP_ERROR ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{MAP_ERROR}（地图加载失败时，仅显示排行榜）</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <MapPin className="text-primary size-3.5" />
              省级分布
            </span>
          }
          description={`共 ${data.length} 个省级行政区`}
          actions={
            <StatusBadge tone="brand" dot>
              模拟数据
            </StatusBadge>
          }
        >
          {MAP_ERROR ? (
            <EmptyState icon={MapPin} title="地图数据加载失败" description="请检查本地数据文件" className="py-32" />
          ) : loading && data.length === 0 ? (
            <Skeleton className="w-full rounded-lg" style={{ height: mapHeight }} />
          ) : (
            <ReactECharts option={mapOption} style={{ height: mapHeight }} opts={{ renderer: 'canvas' }} notMerge />
          )}
        </Panel>

        <Panel title="Top 10 省份排行">
          {loading && data.length === 0 ? (
            <div className="space-y-3 pt-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <ReactECharts option={barOption} style={{ height: isMobile ? 280 : 460 }} opts={{ renderer: 'canvas' }} notMerge />
          )}
        </Panel>
      </div>

    </div>
  )
}
