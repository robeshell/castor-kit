/**
 * 系统指标快照（基于 systeminformation 采集）
 *
 * 字段与单位（统计口径参照 psutil）：
 * - cpu：全局 CPU 使用率（%，1 位小数；与 psutil.cpu_percent(interval=None) 一样是“距上次调用”的区间值）
 * - mem_used / mem_total：MB（1 位小数）；mem_pct：%（1 位）
 *     psutil 口径：Linux used = total - free - buffers - (Cached + SReclaimable)，
 *     macOS used = active + wired；percent = (total - available) / total
 * - disk_used / disk_total：GB（2 位小数），disk_pct：%（1 位），根分区 '/'；
 *     percent = used / (used + avail)（psutil 口径，与 df 一致）
 * - net_sent / net_recv：MB（2 位小数），开机以来所有网卡（含回环）的累计收发字节
 * - ts：毫秒时间戳
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import si from 'systeminformation'

const execFileAsync = promisify(execFile)

export interface SystemSnapshot {
  cpu: number
  mem_used: number
  mem_total: number
  mem_pct: number
  disk_used: number
  disk_total: number
  disk_pct: number
  net_sent: number
  net_recv: number
  ts: number
}

/** 保留 n 位小数：按浮点数的精确十进制值舍入（toFixed） */
function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(digits))
}

const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024

interface MemUsage {
  used: number
  total: number
  percent: number
}

/**
 * macOS：psutil 用 host_statistics64：used = active + wired，available = inactive + free_count；
 * vm_stat 的 "Pages free" 已减去 speculative（free_count - speculative_count），所以要加回来
 */
async function darwinMemory(total: number): Promise<MemUsage> {
  const { stdout } = await execFileAsync('vm_stat')
  const pageSize = Number(/page size of (\d+) bytes/.exec(stdout)?.[1] ?? 4096)
  const pages = (label: string) => Number(new RegExp(`${label}:\\s+(\\d+)`).exec(stdout)?.[1] ?? 0) * pageSize
  const used = pages('Pages active') + pages('Pages wired down')
  const available = pages('Pages inactive') + pages('Pages free') + pages('Pages speculative')
  return { used, total, percent: total ? ((total - available) / total) * 100 : 0 }
}

async function memoryUsage(): Promise<MemUsage> {
  const mem = await si.mem()
  if (process.platform === 'darwin') {
    try {
      return await darwinMemory(mem.total)
    } catch {
      /* vm_stat 不可用时退回通用口径 */
    }
  }
  let used = mem.total - mem.free - mem.buffers - mem.cached - (mem.reclaimable || 0)
  if (used < 0) used = mem.total - mem.free
  const percent = mem.total ? ((mem.total - mem.available) / mem.total) * 100 : 0
  return { used, total: mem.total, percent }
}

async function diskUsage(): Promise<{ used: number; total: number; percent: number }> {
  const disks = await si.fsSize()
  const root = disks.find((d) => d.mount === '/') ?? disks[0]
  if (!root) return { used: 0, total: 0, percent: 0 }
  const denominator = root.used + root.available
  return { used: root.used, total: root.size, percent: denominator ? (root.used / denominator) * 100 : 0 }
}

async function networkTotals(): Promise<{ sent: number; recv: number }> {
  const stats = await si.networkStats('*')
  let sent = 0
  let recv = 0
  for (const s of stats) {
    sent += s.tx_bytes || 0
    recv += s.rx_bytes || 0
  }
  return { sent, recv }
}

/** 采集当前系统指标 */
export async function systemSnapshot(): Promise<SystemSnapshot> {
  const [load, mem, disk, net] = await Promise.all([si.currentLoad(), memoryUsage(), diskUsage(), networkTotals()])
  return {
    cpu: round(load.currentLoad, 1),
    mem_used: round(mem.used / MB, 1),
    mem_total: round(mem.total / MB, 1),
    mem_pct: round(mem.percent, 1),
    disk_used: round(disk.used / GB, 2),
    disk_total: round(disk.total / GB, 2),
    disk_pct: round(disk.percent, 1),
    net_sent: round(net.sent / MB, 2),
    net_recv: round(net.recv / MB, 2),
    ts: Date.now(),
  }
}

let warmedUp: Promise<void> | undefined

/**
 * 预热：systeminformation 的 currentLoad 首次调用要建立基线（且较慢），networkStats 首次调用
 * 要枚举网卡；进程内只做一次
 */
export function warmUp(): Promise<void> {
  warmedUp ??= Promise.allSettled([si.currentLoad(), si.networkStats('*')]).then(() => undefined)
  return warmedUp
}

/** 指标值（非负、至多 2 位小数）的文本形式：整数值带 `.0` */
function pyFloatText(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n)
}

/** `json.dumps({**snapshot, 'type': 'metric'}, ensure_ascii=False)` 的逐字文本 */
export function metricMessage(snapshot: SystemSnapshot): string {
  const parts = (Object.keys(snapshot) as (keyof SystemSnapshot)[]).map((key) => {
    const value = snapshot[key]
    return `"${key}": ${key === 'ts' ? String(value) : pyFloatText(value)}`
  })
  parts.push('"type": "metric"')
  return `{${parts.join(', ')}}`
}
