/**
 * System metrics snapshot (collected via systeminformation)
 *
 * Fields and units (measured the same way as psutil):
 * - cpu: overall CPU usage (%, 1 decimal; like psutil.cpu_percent(interval=None), the value over the interval since the previous call)
 * - mem_used / mem_total: MB (1 decimal); mem_pct: % (1 decimal)
 *     psutil definition: Linux used = total - free - buffers - (Cached + SReclaimable),
 *     macOS used = active + wired；percent = (total - available) / total
 * - disk_used / disk_total: GB (2 decimals), disk_pct: % (1 decimal), root partition '/';
 *     percent = used / (used + avail) (psutil definition, matches df)
 * - net_sent / net_recv: MB (2 decimals), cumulative bytes sent/received on all NICs (incl. loopback) since boot
 * - ts: millisecond timestamp
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

/** Round to n decimals: rounds the float's exact decimal value (toFixed) */
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
 * macOS: psutil uses host_statistics64: used = active + wired, available = inactive + free_count;
 * vm_stat's "Pages free" already excludes speculative (free_count - speculative_count), so add it back
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
      /* fall back to the generic definition when vm_stat is unavailable */
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

/** Collect current system metrics */
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
 * Warm-up: systeminformation's currentLoad has to establish a baseline on its first call (and is slow); networkStats' first call
 * enumerates NICs; done only once per process
 */
export function warmUp(): Promise<void> {
  warmedUp ??= Promise.allSettled([si.currentLoad(), si.networkStats('*')]).then(() => undefined)
  return warmedUp
}

/** Text form of a metric value (non-negative, at most 2 decimals): integral values get `.0` */
function pyFloatText(n: number): string {
  return Number.isInteger(n) ? `${n}.0` : String(n)
}

/** Verbatim text of `json.dumps({**snapshot, 'type': 'metric'}, ensure_ascii=False)` */
export function metricMessage(snapshot: SystemSnapshot): string {
  const parts = (Object.keys(snapshot) as (keyof SystemSnapshot)[]).map((key) => {
    const value = snapshot[key]
    return `"${key}": ${key === 'ts' ? String(value) : pyFloatText(value)}`
  })
  parts.push('"type": "metric"')
  return `{${parts.join(', ')}}`
}
