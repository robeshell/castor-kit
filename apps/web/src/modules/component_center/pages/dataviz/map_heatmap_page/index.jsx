import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { AlertTriangle, MapPin, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

// The China GeoJSON is vendored as china_geo.json (source: Alibaba Cloud DataV,
// https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json) so there is no runtime dependency on an external CDN.
// Registered once at module load; on failure the page degrades to the ranking chart only.
// MAP_ERROR keeps the Chinese source text and is translated when rendered.
let MAP_ERROR = null
try {
  if (!echarts.getMap?.('china')) echarts.registerMap('china', chinaGeoJson)
} catch (err) {
  console.error('Failed to register map data', err)
  MAP_ERROR = '地图数据加载失败，请检查本地数据文件'
}

// The API returns short province names while the GeoJSON uses full names; build a full → short map by prefix match.
// Province names are data (API / GeoJSON), so they are shown as-is and not translated
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
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const c = useChartColors()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  // Only setState in async callbacks; on refresh set loading first, then fetch
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
          return `${params.name}<br/>GDP: <b>${t('{{value}} 亿元', { value: params.value.toLocaleString() })}</b>`
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        text: [t('高'), t('低')],
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
  }, [c, data, maxVal, nameMap, isMobile, t])

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
            // Higher rank, deeper color (after reversing, a larger dataIndex means a higher rank)
            color: (params) => hexToRgba(c['brand-from'], 0.3 + (0.7 * (params.dataIndex + 1)) / Math.max(reversed.length, 1)),
            borderRadius: [0, 4, 4, 0],
          },
          label: {
            show: true,
            position: 'right',
            color: c['muted-foreground'],
            fontSize: 11,
            formatter: (p) => t('{{value}}万亿', { value: (p.value / 10000).toFixed(1) }),
          },
        },
      ],
    }
  }, [c, top10, t])

  const mapHeight = isMobile ? 300 : 500

  return (
    <div className="space-y-5">
      <PageHeader
        title="地图热力图"
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw />}
            {t('刷新数据')}
          </Button>
        }
      />

      {MAP_ERROR ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{t('{{error}}（地图加载失败时，仅显示排行榜）', { error: t(MAP_ERROR) })}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <MapPin className="text-primary size-3.5" />
              {t('省级分布')}
            </span>
          }
          description={t('共 {{count}} 个省级行政区', { count: data.length })}
          actions={
            <StatusBadge tone="brand" dot>
              {t('模拟数据')}
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
