import { useMemo } from 'react'
import { useTheme } from '@/context/ThemeContext'

const VARS = ['--brand-from', '--brand-via', '--brand-to', '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--foreground', '--muted-foreground', '--border', '--card', '--popover', '--success', '--warning', '--danger']

function readVars() {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(VARS.map((v) => [v.slice(2), style.getPropertyValue(v).trim()]))
}

/**
 * ECharts theme colors: reads the actual color values of the current theme (light/dark) from CSS variables, recomputed automatically on theme / accent switch.
 *   const c = useChartColors()
 *   const option = { ...chartBase(c), series: [{ type: 'line', color: c['brand-from'], areaStyle: brandArea(c) }] }
 */
export function useChartColors() {
  const { theme, accent } = useTheme()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readVars(), [theme, accent])
}

/** Shared neutral styling for axes / grid / tooltip */
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

/** Brand gradient area fill */
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

/** Brand gradient line (horizontal blue → cyan) */
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
