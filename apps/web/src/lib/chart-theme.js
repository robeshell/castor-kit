import { useMemo } from 'react'
import { useTheme } from '@/context/ThemeContext'

const VARS = ['--brand-from', '--brand-via', '--brand-to', '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--foreground', '--muted-foreground', '--border', '--card', '--popover', '--success', '--warning', '--danger']

function readVars() {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(VARS.map((v) => [v.slice(2), style.getPropertyValue(v).trim()]))
}

/**
 * ECharts 主题色：从 CSS 变量读取当前主题（亮/暗）的实际色值，主题切换时自动重算。
 *   const c = useChartColors()
 *   const option = { ...chartBase(c), series: [{ type: 'line', color: c['brand-from'], areaStyle: brandArea(c) }] }
 */
export function useChartColors() {
  const { theme } = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readVars(), [theme])
}

/** 坐标轴 / 网格 / 提示框的统一中性样式 */
export function chartBase(c) {
  return {
    color: [c['chart-1'], c['chart-2'], c['chart-3'], c['chart-4'], c['chart-5']],
    textStyle: { fontFamily: 'Geist Variable, PingFang SC, system-ui, sans-serif', color: c['muted-foreground'] },
    grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.popover,
      borderColor: c.border,
      borderWidth: 1,
      textStyle: { color: c.foreground, fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 12px 32px -12px rgba(0,0,0,.25);',
      axisPointer: { lineStyle: { color: c.border } },
    },
    xAxis: {
      axisLine: { lineStyle: { color: c.border } },
      axisTick: { show: false },
      axisLabel: { color: c['muted-foreground'], fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c['muted-foreground'], fontSize: 11 },
      splitLine: { lineStyle: { color: c.border, type: 'dashed' } },
    },
  }
}

/** 品牌渐变面积填充 */
export function brandArea(c, opacity = 0.22) {
  return {
    color: {
      type: 'linear',
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color: hexToRgba(c['brand-from'], opacity) },
        { offset: 1, color: hexToRgba(c['brand-from'], 0) },
      ],
    },
  }
}

/** 品牌渐变线条（横向 blue → cyan） */
export function brandLine(c) {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 1,
    y2: 0,
    colorStops: [
      { offset: 0, color: c['brand-from'] },
      { offset: 0.6, color: c['brand-via'] },
      { offset: 1, color: c['brand-to'] },
    ],
  }
}

export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return hex
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}
