import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { MousePointerClick, RefreshCw, ShoppingCart, Users, Workflow } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { chartBase, hexToRgba, useChartColors } from '@/lib/chart-theme'
import { formatNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import { getTrafficFlowData, type TrafficFlowData } from '@/modules/component_center/api/traffic_flow'
import ReactECharts from '@/shared/components/Chart'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatCard from '@/shared/components/StatCard'
import StatusBadge from '@/shared/components/StatusBadge'
import { useIsMobile } from '@/shared/hooks/useIsMobile'

// Node ids from the API → labels (translated when rendered)
const NODE_LABELS: Record<string, string> = {
  search: '搜索引擎',
  social: '社交媒体',
  direct: '直接访问',
  ads: '广告投放',
  email: '邮件营销',
  home: '首页',
  product: '商品详情',
  campaign: '活动页',
  signup: '注册',
  order: '下单',
  exit: '离开',
}
const STAGE_LABELS: Record<string, string> = { visit: '访问', view: '浏览商品', cart: '加入购物车', order: '下单', pay: '支付' }
const SOURCES = ['search', 'social', 'direct', 'ads', 'email']
const PAGES = ['home', 'product', 'campaign']

export default function TrafficFlowPage() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const c = useChartColors()
  const [data, setData] = useState<TrafficFlowData>({ links: [], funnel: [] })
  const [loading, setLoading] = useState(true)

  // Only setState in async callbacks; on refresh set loading first, then fetch
  const load = useCallback(
    () =>
      getTrafficFlowData()
        .then(setData)
        .catch((err) => toast.apiError(err, '获取流量数据失败'))
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

  const label = useCallback((id: string) => t(NODE_LABELS[id] ?? id), [t])
  const stage = (id: string) => data.funnel.find((f) => f.stage === id)?.value ?? 0
  const visits = stage('visit')
  const signups = data.links.filter((l) => l.target === 'signup').reduce((a, l) => a + l.value, 0)
  const payRate = visits ? (stage('pay') / visits) * 100 : 0

  const sankeyOption = useMemo((): EChartsOption => {
    const base = chartBase(c)
    const colorOf = (id: string) => {
      if (SOURCES.includes(id)) return [c['chart-1'], c['chart-2'], c['chart-3'], c['chart-4'], c['chart-5']][SOURCES.indexOf(id)]
      if (PAGES.includes(id)) return [c['brand-from'], c['brand-via'], c['brand-to']][PAGES.indexOf(id)]
      return id === 'exit' ? hexToRgba(c['muted-foreground'], 0.5) : id === 'order' ? c.success : c.warning
    }
    const ids = [...new Set(data.links.flatMap((l) => [l.source, l.target]))]
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p) => {
          // trigger: 'item' passes one params object (an array only on axis trigger); an edge's data is its { source, target, value } link
          if (Array.isArray(p)) return ''
          const d = p.data
          return p.dataType === 'edge' && typeof d === 'object' && d !== null && 'source' in d && 'target' in d
            ? `${d.source} → ${d.target}<br/><b>${formatNumber(p.value)}</b>`
            : `${p.name}<br/><b>${formatNumber(p.value)}</b>`
        },
      },
      series: [
        {
          type: 'sankey',
          left: 4,
          right: isMobile ? 56 : 88,
          top: 8,
          bottom: 8,
          nodeWidth: 12,
          nodeGap: 14,
          draggable: false,
          emphasis: { focus: 'adjacency' },
          data: ids.map((id) => ({ name: label(id), itemStyle: { color: colorOf(id), borderWidth: 0 } })),
          links: data.links.map((l) => ({ source: label(l.source), target: label(l.target), value: l.value })),
          lineStyle: { color: 'gradient', opacity: 0.32, curveness: 0.5 },
          label: { color: c.foreground, fontSize: 12 },
        },
      ],
    }
  }, [c, data.links, isMobile, label])

  const funnelOption = useMemo((): EChartsOption => {
    const base = chartBase(c)
    const top = data.funnel[0]?.value || 1
    return {
      textStyle: base.textStyle,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        // trigger: 'item' passes one params object (an array only on axis trigger)
        formatter: (p) => (Array.isArray(p) ? '' : `${p.name}<br/><b>${formatNumber(p.value)}</b>`),
      },
      series: [
        {
          type: 'funnel',
          left: 8,
          right: 8,
          top: 8,
          bottom: 8,
          minSize: '18%',
          gap: 4,
          sort: 'descending',
          data: data.funnel.map((f, i) => ({
            name: t(STAGE_LABELS[f.stage] ?? f.stage),
            value: f.value,
            itemStyle: { color: hexToRgba(c['brand-from'], 1 - i * 0.16), borderWidth: 0 },
          })),
          label: {
            position: 'inside',
            color: c.card,
            fontSize: 12,
            formatter: (p) => `${p.name}  ${((Number(p.value) / top) * 100).toFixed(0)}%`,
          },
          labelLine: { show: false },
        },
      ],
    }
  }, [c, data.funnel, t])

  // Text alternatives for screen readers: the largest source of the flow, the funnel's first and last stage
  const sourceTotals = SOURCES.map((id) => ({ id, value: data.links.filter((l) => l.source === id).reduce((a, l) => a + l.value, 0) }))
  const sourceSum = sourceTotals.reduce((a, s) => a + s.value, 0)
  const topSource = sourceTotals.reduce((a, b) => (b.value > a.value ? b : a))
  const sankeySummary = sourceSum
    ? t('流量流向桑基图，{{count}} 个来源共 {{total}} 次访问，最大的来源是{{name}}，占 {{share}}%', {
        count: sourceTotals.filter((s) => s.value > 0).length,
        total: formatNumber(sourceSum),
        name: label(topSource.id),
        share: ((topSource.value / sourceSum) * 100).toFixed(0),
      })
    : t('流量流向桑基图，暂无数据')
  const firstStage = data.funnel[0]
  const lastStage = data.funnel.at(-1)
  const funnelSummary =
    firstStage && lastStage
      ? t('转化漏斗，从{{first}} {{firstValue}} 到{{last}} {{lastValue}}，整体转化率 {{rate}}%', {
          first: t(STAGE_LABELS[firstStage.stage] ?? firstStage.stage),
          firstValue: formatNumber(firstStage.value),
          last: t(STAGE_LABELS[lastStage.stage] ?? lastStage.stage),
          lastValue: formatNumber(lastStage.value),
          rate: firstStage.value ? ((lastStage.value / firstStage.value) * 100).toFixed(1) : '0',
        })
      : t('转化漏斗，暂无数据')

  const chartHeight = isMobile ? 360 : 460
  const empty = loading && data.links.length === 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="流量转化分析"
        actions={
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw />}
            {t('刷新数据')}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="今日访问" value={visits} icon={MousePointerClick} loading={empty} />
        <StatCard label="新增注册" value={signups} icon={Users} loading={empty} />
        <StatCard label="支付转化率" value={payRate} decimals={1} suffix="%" icon={ShoppingCart} loading={empty} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Workflow className="text-primary size-3.5" />
              {t('流量流向')}
            </span>
          }
          description={t('访问来源 → 落地页 → 结果')}
          actions={
            <StatusBadge tone="brand" dot>
              {t('模拟数据')}
            </StatusBadge>
          }
        >
          {empty ? (
            <Skeleton className="w-full rounded-lg" style={{ height: chartHeight }} />
          ) : (
            <ReactECharts option={sankeyOption} summary={sankeySummary} patterns style={{ height: chartHeight }} opts={{ renderer: 'canvas' }} notMerge />
          )}
        </Panel>

        <Panel title="转化漏斗" description={t('各环节占访问量的比例')}>
          {empty ? (
            <Skeleton className="w-full rounded-lg" style={{ height: chartHeight }} />
          ) : (
            <ReactECharts option={funnelOption} summary={funnelSummary} patterns style={{ height: chartHeight }} opts={{ renderer: 'canvas' }} notMerge />
          )}
        </Panel>
      </div>
    </div>
  )
}
